// Orchestrator (PRD F5). Chooses real Gemini vs the built-in mock, applies a
// timeout, retries once, and falls back to the mock so the demo NEVER dead-ends.

import type { Assessment, Space } from '../types';
import { AI_CONFIG, realAiEnabled } from './config';
import { callGemini, hasUsableImages, type DogTraits } from './gemini';
import { generateMockAssessment } from './mock';
import { resolveDog } from '../logic/evaluate';

export interface AssessResult {
  assessment: Assessment;
  source: 'ai' | 'mock';
  // Set when we intended real AI but had to fall back, so the UI can be honest.
  fallbackReason?: string;
}

function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return p(controller.signal).finally(() => clearTimeout(timer));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Turn a raw model error into one friendly sentence for the results banner.
function friendlyFailure(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err)) || '';
  if (/429|quota|rate/i.test(msg)) {
    return 'The free AI quota is used up for now, so this is an example result, not your room. The free tier resets later today.';
  }
  if (/503|unavailable|overload|high demand/i.test(msg)) {
    return 'The AI model was briefly busy, so this is an example result, not your room. Tap “Start over” and try again in a moment.';
  }
  if (/tim-?out|abort|network|fetch/i.test(msg)) {
    return 'The AI took too long or couldn’t be reached, so this is an example result, not your room. Fewer photos check faster.';
  }
  return 'The AI call did not complete, so this is an example result, not your room.';
}

// Time allowed for one room check: more photos, more time (a fixed 30s cancelled
// checks with several photos before Gemini could answer).
export function roomTimeout(session: Space): number {
  const n = Math.min(session.capture.frames.filter((f) => !!f.base64).length, AI_CONFIG.MAX_FRAMES);
  return Math.min(AI_CONFIG.TIMEOUT_MAX_MS, AI_CONFIG.TIMEOUT_MS + n * AI_CONFIG.TIMEOUT_PER_FRAME_MS);
}

const MAX_ATTEMPTS = 3; // initial try + 2 retries (PRD F5.5), with backoff

export async function runAssessment(session: Space): Promise<AssessResult> {
  // The dog's size/energy/noise as the app knows them (catalogue or mixed-breed
  // answers), sent to the model as ground truth.
  const resolved = resolveDog(session.pet);
  const dog: DogTraits | null = resolved
    ? { breed: resolved.name, size: resolved.size, energy: resolved.energy, noise: resolved.noise }
    : null;

  if (realAiEnabled() && hasUsableImages(session)) {
    // Retry with a short backoff so transient free-tier 503 spikes can clear,
    // then fall back to the mock so a demo never dead-ends.
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const assessment = await withTimeout(
          (signal) => callGemini(session, dog, signal),
          roomTimeout(session)
        );
        return { assessment, source: 'ai' };
      } catch (err) {
        lastErr = err;
        // Ran out of time: a retry would just wait as long again, so stop here.
        if (err instanceof Error && /cancel|abort/i.test(err.message)) break;
        if (attempt < MAX_ATTEMPTS - 1) {
          await sleep(1200 * (attempt + 1)); // 1.2s, then 2.4s
        }
      }
    }
    return {
      assessment: generateMockAssessment(session),
      source: 'mock',
      fallbackReason: friendlyFailure(lastErr),
    };
  }

  if (realAiEnabled() && !hasUsableImages(session)) {
    return {
      assessment: generateMockAssessment(session),
      source: 'mock',
      fallbackReason:
        'Real AI is on, but these photos are no longer loaded (the app was restarted), so this is an example result, not your room. Capture the room again to use the model.',
    };
  }

  return { assessment: generateMockAssessment(session), source: 'mock' };
}
