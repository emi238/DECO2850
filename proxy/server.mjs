// Tiny key-holding proxy for LOCAL testing (PRD §4).
//
// The app posts { model, body } here; the proxy adds the secret API key (kept in
// its OWN environment, never on the device) and forwards to Google, returning
// Gemini's response unchanged. This keeps the key off the phone.
//
// Run locally:
//   GEMINI_API_KEY=your-key node proxy/server.mjs
// then point the app at it by putting this in .env.local:
//   EXPO_PUBLIC_PROXY_URL=http://localhost:8787
//
// For real deployment (Vercel etc.) use proxy/api/assess.js instead — see
// proxy/README.md.

import http from 'node:http';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('Set GEMINI_API_KEY in the environment before starting the proxy.');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  // Permissive CORS so the web build can call it too.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'POST only' }));
    return;
  }

  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    try {
      const { model, body } = JSON.parse(raw || '{}');
      if (!model || !body) throw new Error('Expected { model, body }');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await upstream.text();
      console.log(`${new Date().toISOString()} model=${model} -> ${upstream.status}`);
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
      res.end(text); // pass Gemini's response straight back to the app
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err && err.message ? err.message : err) }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`PawSpace key-holding proxy listening on http://localhost:${PORT}`);
});
