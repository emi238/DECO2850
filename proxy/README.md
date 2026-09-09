# PawSpace key-holding proxy (PRD §4)

A tiny server that holds your Google API key so it **never sits on the phone**.
The app sends the request here; the proxy adds the key and forwards it to Google.

Recommended before you ever put the app in front of real users. For a throwaway
class demo, calling Google directly with the key in `.env.local` is fine.

## How the app finds it

The app uses the proxy automatically when `EXPO_PUBLIC_PROXY_URL` is set in
`.env.local`. When it's empty, the app calls Google directly with the key.

---

## Option A — test it locally (no account needed)

1. In one terminal, start the proxy with your key:

   ```bash
   GEMINI_API_KEY=your-key node proxy/server.mjs
   ```

2. In `.env.local`, point the app at it and remove the on-device key:

   ```
   EXPO_PUBLIC_USE_MOCK=false
   EXPO_PUBLIC_PROXY_URL=http://localhost:8787
   # EXPO_PUBLIC_GEMINI_API_KEY can now be left empty
   ```

3. Restart the dev server: `npx expo start --ios --clear`.

Note: `localhost` works from the iOS Simulator (same machine). On a **physical
phone**, `localhost` means the phone itself — use Option B, or your Mac's LAN IP.

---

## Option B — deploy to Vercel (free), so real phones can use it

1. Install the CLI and log in (this uses **your** Vercel account):

   ```bash
   npm i -g vercel
   vercel login
   ```

2. From the `proxy/` folder, deploy:

   ```bash
   cd proxy
   vercel --prod
   ```

3. In the Vercel dashboard → your project → Settings → Environment Variables, add:

   ```
   GEMINI_API_KEY = your-key
   ```

   (Set it in the dashboard, never in the code.) Redeploy if prompted.

4. Put the deployed URL in `.env.local` and drop the on-device key:

   ```
   EXPO_PUBLIC_USE_MOCK=false
   EXPO_PUBLIC_PROXY_URL=https://your-project.vercel.app/api/assess
   ```

5. Restart the dev server. The key now lives only on the server.

The same `api/assess.js` also works on Netlify Functions / Cloudflare Workers with
minor tweaks; Vercel is the quickest path.
