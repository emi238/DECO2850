// ─────────────────────────────────────────────────────────────────────────
//  PawSpace AI configuration  —  the ONE file you edit to turn on real AI.
// ─────────────────────────────────────────────────────────────────────────
//
// Out of the box PawSpace runs in MOCK mode: it returns a realistic, built-in
// assessment so the whole flow demos end-to-end with zero setup.
//
// To use the real Gemini model instead:
//   1. Get a free key at https://aistudio.google.com/apikey  (no credit card).
//   2. Paste it below into GEMINI_API_KEY.
//   3. Set USE_MOCK to false.
//   4. Reload the app.
//
// Note: real AI needs real camera photos (the built-in demo room is a drawing,
// not a photo). Capture a room on a real device, then analyse.

export const AI_CONFIG = {
  // Leave USE_MOCK = true for the no-setup demo. Set to false once a key is in.
  USE_MOCK: true,

  // Paste your Google AI Studio key here (keep the quotes). Empty = mock only.
  GEMINI_API_KEY: '',

  // Free, fast, multimodal (PRD §7.1). Change only if you know you need to.
  MODEL: 'gemini-2.5-flash',

  // Optional: if you deploy the thin proxy (PRD §4) to keep the key off the
  // device, put its URL here and it will be used instead of calling Google
  // directly. Leave empty to call Google directly with the key above.
  PROXY_URL: '',

  // Cap frames sent to stay within rate/token limits (PRD §7.4).
  MAX_FRAMES: 10,

  // Per-attempt timeout (ms) before we retry once, then fall back.
  TIMEOUT_MS: 30000,
};

// Real AI is only attempted when explicitly enabled AND a key (or proxy) exists.
export function realAiEnabled(): boolean {
  if (AI_CONFIG.USE_MOCK) return false;
  return AI_CONFIG.GEMINI_API_KEY.trim() !== '' || AI_CONFIG.PROXY_URL.trim() !== '';
}
