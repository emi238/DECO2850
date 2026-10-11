# PawSpace — Pet-Space Suitability MVP

PawSpace helps a prospective adopter check whether their living space suits a pet
**before** they adopt. You capture a room, say which pet you have in mind (or ask
the app to suggest pets), answer a short questionnaire, tag anything important, and
get an AI assessment — **hazards, a suitability verdict, and concrete fixes, pinned
onto a 2D map of the room**.

This is the demo MVP built from `PawSpace_MVP_PRD.md`. It's an **Expo (React Native)**
app and runs on a real iPhone/Android phone or in the iOS Simulator.

---

## How it's organised

The **first run is an onboarding flow** for your first space; after that the app
opens on a **Home hub**.

- **Home** is the main screen: it shows the current space's room map with a
  **2D map / 3D room toggle**, a row of **space tabs** to switch between spaces,
  an **+ Add space** button (which re-runs the onboarding for a new room), and
  buttons to **Edit questionnaire** (edits the space's answers and re-analyses)
  and **Re-analyse**. Tap the space name to rename it, or **Delete** to remove it.
- **Add space** lets you build as many rooms as you like — living room, garage,
  bedroom, … — each with its own capture, pet, questionnaire, tags and result.

## The onboarding flow (per space)

**Name space → Capture → Pet mode → Questionnaire → Tag objects → Results**

1. **Capture** — sweep the phone across the room and it snaps ~10 frames, assembled
   into one scrollable 2D map. You can also **Upload photos** or **Upload a video**
   from your library instead (a video is auto-sampled into frames). No camera or
   media (e.g. the Simulator)? Tap **"Use demo room"** for a built-in illustrated room.
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

### AR placement preview (development build)

The Home screen includes **Try AR marker placement**. It opens a native ARKit/ARCore
view, detects horizontal floor planes, and lets you tap a plane to place a small
PawSpace marker. The marker is local to that AR session; this preview does not scan
or measure the room, save anchors, or detect hazards.

ViroReact uses native code, so this screen does not run in Expo Go. Create an Android
development APK once, then use the development client and Metro for later JavaScript
changes:

```powershell
.\node_modules\.bin\eas.cmd login
.\.toolchain\node\npm.cmd run build:android:dev
```

When EAS finishes, open its build link on your Android phone and install the APK.
Enable **Install unknown apps** for the browser if Android asks. Then, from the repo
on your computer, start Metro for the development client:

```powershell
.\scripts\start-android.ps1
```

Connect the phone and computer to the same Wi-Fi, scan the terminal QR code with the
phone camera, and open PawSpace. Tap **Try AR marker placement**, grant camera
permission, point the phone at a textured, well-lit floor, move it slowly until a
plane is detected, then tap the floor. Use **Reset** to start a fresh AR session.
The AR runtime needs a physical ARCore-supported Android device; it will not work in
Expo Go or the Android emulator. Google's maintained compatibility list is at
<https://developers.google.com/ar/devices>.

Rebuild the APK after changing native dependencies or Expo config. TypeScript and UI
changes can be loaded over Metro without rebuilding the native client.

### 3D room view (experimental — this branch)

From the Results screen, **View in 3D** opens a generated, movable 3D room: drag to
orbit, pinch to zoom, and the hazardous objects are highlighted with numbered risk
markers — tap one to pop up its risk card. It's rendered with three.js in a WebView
(needs an internet connection to load three.js), so it still runs in Expo Go with no
native code. This is a stand-in for future room reconstruction — a *generated* room,
not a photoreal reconstruction of your photos.

---

## Run it

The repository includes a project-local Node.js setup for Windows, so a system-wide
Node installation is not needed. From PowerShell at the repository root, run setup
once to download the verified Node.js runtime and install the locked project tools:

```powershell
.\scripts\setup.ps1
```

Start the app on Android with:

```powershell
.\scripts\start-android.ps1
```

Node is kept under the ignored `.toolchain/` folder and packages under ignored
`node_modules/`; rerun setup to recreate them. The lockfile pins app dependencies.
The native AR screen requires a development build; Expo Go remains suitable for
app flows that do not use AR.

For the AR APK, use the EAS cloud build command above. Commands such as
`npm run android` or `npx expo run:android` build or launch through a local Android
SDK and require Android Studio/ADB; they are not needed for the EAS workflow.

---

## Turn on the real AI (optional)

Out of the box the app runs in **demo mode**: it shows a realistic, built-in sample
assessment so the whole flow works with zero setup. To use the real Google Gemini
model instead, put your key in a **private, git-ignored file** (never in the code):

1. Get a free API key at <https://aistudio.google.com/apikey> (no credit card).
2. Create a file called **`.env.local`** in the project root with these two lines:

   ```
   EXPO_PUBLIC_USE_MOCK=false
   EXPO_PUBLIC_GEMINI_API_KEY=your-key-here
   ```

3. Restart the dev server: `npx expo start --ios --clear`.

`.env.local` is ignored by git (see `.gitignore`), so your key can never be committed.
The model is `gemini-3.6-flash` by default (override with `EXPO_PUBLIC_GEMINI_MODEL`).

Real AI needs real **images**: on the iOS Simulator the built-in demo room is turned
into images automatically so it works there too; on a phone your camera sweep is used.
If the model is busy or the free-tier quota is used up, the app retries a few times and
then falls back to the sample assessment with a short, friendly note — a demo never
dead-ends.

**Keep the key off the phone (recommended before real users):** deploy the tiny proxy
in [`proxy/`](proxy/README.md) and set `EXPO_PUBLIC_PROXY_URL` instead of the key.

> Privacy note: on Gemini's free tier your inputs may be used to improve Google's
> models, and the free tier is rate-limited. Demo with your own / non-sensitive rooms.

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

Automatic room reconstruction, accounts / cloud sync, and offline inference are out
of scope for the demo (see PRD §2 and §3). Pin positions are approximate, as the PRD
notes.
