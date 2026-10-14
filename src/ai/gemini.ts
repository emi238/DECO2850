// Real multimodal call to Gemini (PRD §7.1/§7.3). Only used when realAiEnabled().
// Assembles: system prompt + context JSON + inline image parts, asks for JSON,
// and parses defensively. Requires real camera frames with base64 bytes.

import { AI_CONFIG } from './config';
import { SYSTEM_PROMPT } from './prompt';
import { normaliseAssessment } from './normalise';
import type { Assessment, Space } from '../types';

interface InlineImage {
  mime_type: string;
  data: string; // base64, no data: prefix
}

// Only the questions the user actually answers are sent. Fields the questionnaire
// never asks (adults, activity level…) hold defaults, and the model would treat
// them as facts. Missing answers are sent as "not_answered".
export function householdContext(q: Space['questionnaire']) {
  return {
    dwelling: q.dwelling,
    rental: q.rental,
    neighbours: q.neighbours,
    outdoor_access: q.outdoor_access,
    existing_dogs: q.existing_pets.map((p) => p.breed || 'dog'),
    children_at_home: q.children_at_home ?? 'not_answered',
    hours_alone: q.hours_alone ?? 'not_answered',
  };
}

function contextJson(session: Space): string {
  return JSON.stringify({
    mode: session.mode,
    pet: session.pet && {
      breed: session.pet.breed,
      size: session.pet.size,
      energy: session.pet.energy,
      noise: session.pet.noise,
    },
    household: householdContext(session.questionnaire),
    tags: session.tags.map((t) => ({ label: t.label, note: t.note, frame: t.frame })),
  });
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

export async function callGemini(session: Space, signal: AbortSignal): Promise<Assessment> {
  const images = collectImages(session);
  const parts: any[] = [
    { text: SYSTEM_PROMPT },
    { text: 'CONTEXT:\n' + contextJson(session) },
    ...images.map((img) => ({ inline_data: img })),
  ];

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
  };

  const text = await generateText(body, signal);
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
