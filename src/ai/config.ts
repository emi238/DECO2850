// ─────────────────────────────────────────────────────────────────────────
//  PawSpace AI configuration
// ─────────────────────────────────────────────────────────────────────────
//
// Out of the box PawSpace runs in MOCK mode: it returns a realistic, built-in
// assessment so the whole flow demos end-to-end with zero setup.
//
// To use the real Gemini model, DO NOT paste your key here. Instead put it in a
// private file called ".env.local" in the project root (git ignores that file,
// so your key can never be committed). Create ".env.local" with these two lines:
//
//     EXPO_PUBLIC_USE_MOCK=false
//     EXPO_PUBLIC_GEMINI_API_KEY=your-key-here
//
// Get a free key at https://aistudio.google.com/apikey  (no credit card), then
// restart the dev server so the new values load.
//
// Note: real AI needs real photos of the room. On the iOS Simulator the built-in
// demo room is rasterised (turned into an image) before sending, so real AI works
// there too; on a phone, your camera sweep is used.

const env = process.env as Record<string, string | undefined>;

export const AI_CONFIG = {
  // true = built-in sample assessment (no setup). Set EXPO_PUBLIC_USE_MOCK=false
  // in .env.local to call the real model. Defaults to mock when unset.
  USE_MOCK: env.EXPO_PUBLIC_USE_MOCK ? env.EXPO_PUBLIC_USE_MOCK !== 'false' : true,

  // Read from .env.local (never hard-coded, never committed). Empty = mock only.
  GEMINI_API_KEY: env.EXPO_PUBLIC_GEMINI_API_KEY ?? '',

  // Free, fast, multimodal (PRD §7.1). Override with EXPO_PUBLIC_GEMINI_MODEL.
  // (gemini-2.5-flash is retired for new keys; 3.6-flash is the current free one.)
  MODEL: env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-3.6-flash',

  // Optional thin proxy that holds the key server-side (PRD §4). Empty = call
  // Google directly with the key above.
  PROXY_URL: env.EXPO_PUBLIC_PROXY_URL ?? '',

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
