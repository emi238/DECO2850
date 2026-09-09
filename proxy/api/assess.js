// Deployable key-holding proxy (PRD §4) — Vercel serverless function.
//
// Deploy this folder to Vercel (see proxy/README.md). Set the GEMINI_API_KEY
// environment variable in the Vercel dashboard (NOT in code). Then point the app
// at the deployed URL by putting this in .env.local:
//   EXPO_PUBLIC_PROXY_URL=https://your-project.vercel.app/api/assess
//
// The app posts { model, body }; this adds the secret key and forwards to Google,
// returning Gemini's response unchanged, so the key never reaches the device.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not set on the server' });

  try {
    const { model, body } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!model || !body) return res.status(400).json({ error: 'Expected { model, body }' });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    return res.send(text);
  } catch (err) {
    return res.status(400).json({ error: String(err && err.message ? err.message : err) });
  }
}
