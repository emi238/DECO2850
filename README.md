# PawSpace — Pet-Space Suitability MVP

PawSpace helps a prospective adopter check whether their living space suits a pet
**before** they adopt. You capture a room, say which pet you have in mind (or ask
the app to suggest pets), answer a short questionnaire, tag anything important, and
get an AI assessment — **hazards, a suitability verdict, and concrete fixes, pinned
onto a 2D map of the room**.

This is the demo MVP built from `PawSpace_MVP_PRD.md`. It's an **Expo (React Native)**
app and runs on a real iPhone/Android phone or in the iOS Simulator.

---

## The flow (5 screens)

**Capture → Pet mode → Questionnaire → Tag objects → Results**

1. **Capture** — sweep the phone across the room and it snaps ~10 frames, assembled
   into one scrollable 2D map. No camera (e.g. the Simulator)? Tap **"Use demo room"**
   for a built-in illustrated room.
2. **Pet mode** — "I have a pet in mind" (pick species + breed) or "Explore breeds for
   my space."
3. **Questionnaire** — dwelling, floor, outdoor access, occupants, existing pets,
   off-limit zones, activity level. Sensible defaults are pre-filled.
4. **Tag objects** — tap anything on the map to flag it with a label + note (the AI
   treats tags as top priority).
5. **Results** — the room map with findings pinned in place: coloured markers by
   severity, tap a pin for a finding card, whole-room findings + the verdict in a
   banner at the top, and a full list behind the "All findings" button.

Everything you enter is saved locally on the device, so it survives navigating back
and forth.

---

## Run it

You need Node and the Xcode iOS Simulator (already set up on this machine).

```bash
npm install
```

Then start it and open on iOS:

```bash
npx expo start --ios
```

- **iOS Simulator:** the app opens in Expo Go. The Simulator has no camera, so use
  the **"Use demo room"** button on the capture screen.
- **Your own phone:** install **Expo Go** from the App Store / Play Store, run
  `npx expo start`, and scan the QR code. The live camera sweep works here.

---

## Turn on the real AI (optional)

Out of the box the app runs in **demo mode**: it shows a realistic, built-in sample
assessment so the whole flow works with zero setup. To use the real Google Gemini
model instead, edit **one file**: [`src/ai/config.ts`](src/ai/config.ts).

1. Get a free API key at <https://aistudio.google.com/apikey> (no credit card).
2. In `src/ai/config.ts`, paste it into `GEMINI_API_KEY` and set `USE_MOCK` to `false`.
3. Reload the app.

Real AI needs real **camera photos** (the built-in demo room is a drawing, not a
photo), so capture a real room on a phone, then analyse. If the AI call fails or times
out, the app automatically falls back to the sample assessment so a demo never
dead-ends.

> Privacy note: on Gemini's free tier your inputs may be used to improve Google's
> models. Demo with your own / non-sensitive rooms only.

---

## How it's built

- **App:** Expo + React Navigation, one screen per step under `src/screens/`.
- **State:** a single session store (`src/store/session.ts`) persisted to the device
  with AsyncStorage — this is the "what gets remembered" data model from the PRD.
- **Demo room:** drawn as SVG in `src/demo/room.tsx`; the 8 sweep frames are windows
  into one wide room scene, so the overlap and object positions are consistent.
- **AI layer** (`src/ai/`): `prompt.ts` (the system prompt), `mock.ts` (the built-in
  assessment), `gemini.ts` (the real call), `normalise.ts` (defensive JSON parsing),
  and `assess.ts` (chooses AI vs mock, retries once, falls back).
- **Results map:** `src/screens/ResultsScreen.tsx` renders the pins, finding cards,
  banner, and list.

## Not in this MVP (by design)

LiDAR / true 3D reconstruction, accounts / cloud sync, and offline inference are out
of scope for the demo (see PRD §2 and §3). Pin positions are approximate, as the PRD
notes.
