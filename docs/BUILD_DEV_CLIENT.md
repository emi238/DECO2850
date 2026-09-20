# Running the Live AR scan (development build)

The Live AR scan (camera + YOLO object detection) uses native modules that **do
not exist in Expo Go and cannot run in the Simulator**. To try it you make a
one-time **development build** and install it on a **real phone** (any phone — no
LiDAR needed). Everything else in PawSpace keeps working in Expo Go as normal.

## What's already wired up

- `src/live/coco.ts` — COCO-80 class → hazard-category mapping (unit-tested).
- `src/live/yolo.ts` — YOLOv8 output decode + non-max-suppression (unit-tested).
- `src/live/LiveScanNative.tsx` — the camera + model + on-screen detection labels,
  and a "Use findings" button that feeds detections into the normal analysis.
- `src/screens/LiveScanScreen.tsx` — shows a placeholder in Expo Go, the real
  screen in a dev build.
- Deps installed: `react-native-vision-camera@4`, `react-native-fast-tflite`,
  `react-native-worklets-core`, `vision-camera-resize-plugin`.
- `app.json` — vision-camera + fast-tflite config plugins.

## Two one-time steps before the first dev build

### 1. Enable worklets (needed by the camera frame processor)

vision-camera's frame processor runs the model on a worklet, which needs a Babel
plugin. This is **deliberately not committed** — adding it locally destabilises the
Expo Go / Simulator workflow (Expo Go supplies its own Babel config internally). Add
it only when you move to the dev build:

Create `babel.config.js` in the project root:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets-core/plugin'],
  };
};
```

`babel-preset-expo` is already in `package.json`. If Metro then complains it can't
find a `@babel/...` plugin, your local `node_modules` tree is incomplete — do a clean
install: `rm -rf node_modules && npm install`. **EAS cloud builds do a clean install
automatically, so they resolve the full Babel toolchain on their own.** After adding
the file locally, always restart Metro with `npx expo start -c`.

Note: once you're on the dev build you use `npx expo start --dev-client` instead of
Expo Go. To go back to Expo Go for non-AR work, delete `babel.config.js` again.

### 2. Add a detection model

Get a **YOLOv8 model exported to TensorFlow Lite** (COCO, 640×640 input):

- Easiest: download a prebuilt `yolov8n.tflite`, or
- Export one: `pip install ultralytics` then `yolo export model=yolov8n.pt format=tflite imgsz=640`.

Put it in `assets/models/yolov8n.tflite`, then in `src/live/LiveScanNative.tsx` set:

```ts
const MODEL_URL = require('../../assets/models/yolov8n.tflite');
```

(or host it and use a `https://…` URL). Licensing note: Ultralytics YOLOv8 is
**AGPL-3.0** — fine for a uni prototype; check your course rules before distributing,
or use an MIT/Apache detector instead.

## Build & run — pick one route

### Route A — Expo EAS cloud build (no Mac needed)

```bash
npm install -g eas-cli
eas login
eas build:configure
# Android (simplest to install):
eas build --profile development --platform android
# iOS (needs a paid Apple Developer account + your device registered):
eas build --profile development --platform ios
```

Install the finished build on your phone from the EAS link, then start the dev
server and open the app:

```bash
npx expo start --dev-client
```

### Route B — Mac with Xcode (local build)

```bash
npx expo prebuild            # generates the native ios/ + android/ projects
npx expo run:ios --device    # build onto a plugged-in iPhone
# or: npx expo run:android
```

## Testing it on the phone

1. Open PawSpace on the phone → Home → **Live AR scan (beta)**.
2. Grant the camera permission.
3. Point the camera around a room — detection boxes + hazard labels should track
   objects as you move.
4. Tap **Use findings** → it drops you into the normal analysis with the detected
   hazards, so the Recommendations tab, shopping list and off-limits tagging all
   work off the live scan.

## First-run tuning (expected)

The camera + model wiring in `LiveScanNative.tsx` is a reference implementation
that hasn't been run on a device yet. If boxes look wrong on first run, check, in
order:

- **Input size** — `INPUT_SIZE` (640) must match the exported model.
- **Output layout** — `decodeYolo` in `src/live/yolo.ts` assumes YOLOv8's
  `[1, 84, 8400]` class-major layout with pixel coords. If your export differs,
  set `layout: 'box-major'` and/or `inputSize: 1` (already-normalised boxes).
- **Confidence** — lower `CONF` (0.4) if nothing shows; raise it if it's noisy.
- **Worklet errors** — usually the babel plugin (step 1) or a Metro cache; run
  `npx expo start -c`.
