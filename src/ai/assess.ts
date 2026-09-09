// Orchestrator (PRD F5). Chooses real Gemini vs the built-in mock, applies a
// timeout, retries once, and falls back to the mock so the demo NEVER dead-ends.

import type { Assessment, Session } from '../types';
import { AI_CONFIG, realAiEnabled } from './config';
import { callGemini, hasUsableImages } from './gemini';
import { generateMockAssessment } from './mock';

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
    return 'The free AI quota is used up for now, so this is a sample assessment. The free tier resets later today.';
  }
  if (/503|unavailable|overload|high demand/i.test(msg)) {
    return 'The AI model was briefly busy, so this is a sample assessment. Tap “Start over” and try again in a moment.';
  }
  if (/tim-?out|abort|network|fetch/i.test(msg)) {
    return 'The AI could not be reached (network/timeout), so this is a sample assessment.';
  }
  return 'The AI call did not complete, so this is a sample assessment.';
}

const MAX_ATTEMPTS = 3; // initial try + 2 retries (PRD F5.5), with backoff

export async function runAssessment(session: Session): Promise<AssessResult> {
  if (realAiEnabled() && hasUsableImages(session)) {
    // Retry with a short backoff so transient free-tier 503 spikes can clear,
    // then fall back to the mock so a demo never dead-ends.
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const assessment = await withTimeout(
          (signal) => callGemini(session, signal),
          AI_CONFIG.TIMEOUT_MS
        );
        return { assessment, source: 'ai' };
      } catch (err) {
        lastErr = err;
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
        'Real AI is enabled but these frames have no photo data (the demo room is a drawing). Capture a real room to use the model.',
    };
  }

  return { assessment: generateMockAssessment(session), source: 'mock' };
}
