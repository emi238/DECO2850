// Real multimodal call to Gemini (PRD §7.1/§7.3). Only used when realAiEnabled().
// Assembles: system prompt + context JSON + inline image parts, asks for JSON,
// and parses defensively. Requires real camera frames with base64 bytes.

import { AI_CONFIG } from './config';
import { SYSTEM_PROMPT } from './prompt';
import { ROOM_RESPONSE_SCHEMA } from './schema';
import { normaliseAssessment } from './normalise';
import type { Assessment, Space } from '../types';

interface InlineImage {
  mime_type: string;
  data: string; // base64, no data: prefix
}

// Only the questions the user actually answers are sent. Fields the questionnaire
// never asks (adults, activity level…) hold defaults, and the model would treat
// them as facts. Missing answers are sent as "not_answered". Shared by the room
// prompt and the breed prompt.
export function householdContext(q: Space['questionnaire']) {
  const na = 'not_answered';
  return {
    dwelling: q.dwelling,
    rental: q.rental,
    neighbours: q.neighbours,
    outdoor_access: q.outdoor_access,
    outdoor_use: q.outdoor_access === 'none' ? 'not_applicable' : q.outdoor_use ?? na,
    children_at_home: q.children_at_home ?? na,
    hours_alone: q.hours_alone ?? na,
    alone_plan: q.alone_plan ?? na,
    owner_activity: q.owner_activity ?? na,
    exercise_time: q.exercise_time ?? na,
    experience: q.experience ?? na,
    household_atmosphere: q.household_atmosphere ?? na,
    allergies: q.allergies ?? na,
    existing_pets: {
      dogs: q.existing_pets.filter((p) => /dog/i.test(p.species)).map((p) => p.breed || 'dog'),
      // Pets other than dogs: a list (empty = none), or not_answered.
      other: q.has_other_pets === undefined ? na : q.has_other_pets ? q.other_pets ?? [] : [],
    },
  };
}

// The dog's traits come from the app's breed data (resolved when the breed was
// picked) and are ground truth for the model (W10).
function contextJson(session: Space, dog: DogTraits | null): string {
  return JSON.stringify({
    dog: dog ?? (session.pet ? { breed: session.pet.breed } : null),
    household: householdContext(session.questionnaire),
    tags: session.tags
      .filter((t) => !t.offLimits)
      .map((t) => ({ id: t.id, label: t.label, note: t.note, frame: t.frame, x: t.x ?? null, y: t.y ?? null })),
    // Areas the owner has marked off-limits (frame null = not tied to a photo).
    off_limit_areas: session.tags
      .filter((t) => t.offLimits)
      .map((t) => ({
        label: t.label,
        frame: t.frame >= 0 ? t.frame : null,
        x: t.frame >= 0 ? t.x ?? null : null,
        y: t.frame >= 0 ? t.y ?? null : null,
      })),
  });
}

export interface DogTraits {
  breed: string;
  size: 'small' | 'medium' | 'large';
  energy: 'low' | 'moderate' | 'high';
  noise: 'quiet' | 'moderate' | 'vocal';
}

function collectImages(session: Space): InlineImage[] {
  return session.capture.frames
    .filter((f) => !!f.base64)
    .slice(0, AI_CONFIG.MAX_FRAMES)
    .map((f) => ({ mime_type: f.mime ?? 'image/jpeg', data: f.base64 as string }));
}

export function hasUsableImages(session: Space): boolean {
  return collectImages(session).length > 0;
}

// Strip ``` fences and any prose around the JSON body before parsing (PRD §7.4).
function extractJson(text: string): any {
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    t = t.slice(start, end + 1);
  }
  return JSON.parse(t);
}

export async function callGemini(session: Space, dog: DogTraits | null, signal: AbortSignal): Promise<Assessment> {
  const images = collectImages(session);
  const parts: any[] = [
    { text: SYSTEM_PROMPT },
    { text: 'CONTEXT:\n' + contextJson(session, dog) },
    ...images.map((img) => ({ inline_data: img })),
  ];

  const body = (withSchema: boolean) => ({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      // The API only returns JSON matching this (W11).
      ...(withSchema ? { responseSchema: ROOM_RESPONSE_SCHEMA } : {}),
      temperature: 0.4,
    },
  });

  let text: string;
  try {
    text = await generateText(body(true), signal);
  } catch (e) {
    // If the API rejects the schema itself (HTTP 400, e.g. "too complex"), ask once
    // more without it: the prompt describes the same shape, and normalise.ts checks
    // every value either way. Other errors go to assess.ts's retries and fallback.
    if (!(e instanceof Error) || !/HTTP 400/.test(e.message)) throw e;
    text = await generateText(body(false), signal);
  }
  const raw = extractJson(text);
  return normaliseAssessment(raw, session);
}

// Sends a Gemini request body (direct with the key, or via the proxy) and returns
// the model's text. Shared by the room assessment and breed suggestions.
export async function generateText(body: unknown, signal: AbortSignal): Promise<string> {
  let url: string;
  let init: RequestInit;

  if (AI_CONFIG.PROXY_URL.trim()) {
    // Thin proxy holds the key (PRD §4). It receives model + body, forwards it.
    url = AI_CONFIG.PROXY_URL.trim();
    init = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AI_CONFIG.MODEL, body }),
      signal,
    };
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.MODEL}:generateContent?key=${AI_CONFIG.GEMINI_API_KEY.trim()}`;
    init = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    };
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }
  const json = await res.json();
  const text: string =
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
  if (!text) throw new Error('Empty response from model');
  return text;
}

export { extractJson };
