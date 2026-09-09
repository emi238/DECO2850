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

export async function runAssessment(session: Session): Promise<AssessResult> {
  if (realAiEnabled() && hasUsableImages(session)) {
    // Try once, retry once (PRD F5.5), then fall back to the mock.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const assessment = await withTimeout(
          (signal) => callGemini(session, signal),
          AI_CONFIG.TIMEOUT_MS
        );
        return { assessment, source: 'ai' };
      } catch (err) {
        if (attempt === 1) {
          return {
            assessment: generateMockAssessment(session),
            source: 'mock',
            fallbackReason:
              'The AI call failed twice, so this shows a sample assessment instead. ' +
              (err instanceof Error ? err.message : String(err)),
          };
        }
      }
    }
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
