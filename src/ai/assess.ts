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
      fallbackReason:
        `The AI model was unreachable after ${MAX_ATTEMPTS} tries, so this shows a sample ` +
        'assessment instead. ' + (lastErr instanceof Error ? lastErr.message : String(lastErr)),
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
