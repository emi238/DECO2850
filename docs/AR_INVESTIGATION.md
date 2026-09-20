# AR immersive scan — investigation & handoff

**Purpose:** hand this off to whoever continues the AR work. It records what was
investigated, the evidence, the decision, exactly what's been built, and — if the
team picks the Google/ARCore path — what to do next.

**Feature goal:** an immersive scan where the user walks around a room, the app
identifies objects, and hazard/risk/improvement labels pop up over them in real
time (spec Phase 1/4). Detected objects feed the existing dog-suitability logic
(`src/logic/evaluate.ts` + `src/logic/recommend.ts`).

**Hard constraint that drove every decision:** the team has **non‑Pro iPhones with
no LiDAR sensor**. So any option that needs LiDAR is out.

---

## 1. The AR stack is 5 layers

Any "camera → detect objects → label them" feature is assembled from these. You
pick a tool per layer; they're independent.

| Layer | Job | Options |
|---|---|---|
| 1. Camera feed | live video | vision-camera (RN), ARKit/ARCore, Unity |
| 2. Spatial tracking *(optional)* | anchor things in 3D, plane/floor detection | ARKit (iOS), ARCore (Android + iOS), Unity AR Foundation |
| 3. Detection model | the AI that finds objects | **YOLO** (v8/v11), MobileNet‑SSD |
| 4. Inference runtime | runs the model on-device | **TensorFlow Lite**, Core ML, Unity Sentis |
| 5. Overlay / render | draw the labels | RN views, three.js, Unity |
| 6. App logic | suitability + recommendations | existing `evaluate.ts` / `recommend.ts` (reused as‑is) |

The single most important finding: **object detection is layer 3–4, and it is a
separate concern from AR tracking (layer 2).** Several "AR platforms" (RoomPlan,
ARCore, ARKit) only do layers 1–2 and do **not** detect everyday objects. You always
need a detection model (YOLO) for the "find the hazards" part.

---

## 2. Options investigated (with evidence)

### A. Apple RoomPlan — REJECTED (needs LiDAR/Pro)
- Source: developer.apple.com/augmented-reality/roomplan/ (checked 2026‑09).
- Evidence: Swift/ARKit API; **requires a LiDAR scanner** (iPhone 12 Pro+ / iPad
  Pro); native code only; **does not run in Expo Go and cannot run in the iOS
  Simulator**. Outputs a parametric 3D floor plan (USDZ) with furniture types.
- Why rejected: the team has no LiDAR/Pro device. Its unique value (an exact 3D
  floor plan) is the one thing the chosen path lacks — keep it as a *future* upgrade
  only if a LiDAR device appears.

### B. Google ARCore / "ARCore SDK for iOS" — VIABLE but wrong layer
The team asked specifically about the Google path ("iOS 12+, builds on ARKit, uses
LiDAR only if available"). **Those claims are all TRUE** — verified against Google's
docs (developers.google.com/ar, checked 2026‑09):

| Claim | Verified |
|---|---|
| There is an ARCore SDK for iOS | ✅ |
| Works on iOS 12.0+ | ✅ deployment target 12.0+, built with the iOS 15 SDK |
| Runs on non‑Pro iPhones | ✅ "all ARKit‑compatible devices" (iPhone 6S and up) |
| Builds on Apple ARKit | ✅ uses the ARKit session on iOS |
| LiDAR only if available | ✅ that's ARKit's behaviour, inherited — never required |

**BUT — the catch:** ARCore on iOS only provides **Cloud Anchors**, the **Geospatial
API**, and **Augmented Faces**. It has **no general object detection** — it cannot
recognise a plant, knife, oven, sofa, etc. Its **Depth API** and **Scene Semantics**
are **Android‑only**, and Scene Semantics is *outdoor* scene segmentation
(sky/building/road), not indoor furniture.

Consequences:
- ARCore **does not replace YOLO.** You would still need a detection model for the
  hazards; ARCore only adds layer‑2 anchoring on top.
- **On iOS, ARCore just wraps ARKit** → redundant unless you need one codebase across
  iOS *and* Android, or Google's cloud features (shared/persistent/outdoor AR), none
  of which this app needs.
- Still requires **native code + a development build** (same as everything else).

### C. Unity + AR Foundation + Sentis — POWERFUL but overkill
- Evidence: Unity AR Foundation wraps ARKit+ARCore (no LiDAR needed); Unity Sentis
  runs an ONNX YOLO model on‑device; Unity renders world‑anchored 3D.
- Why not: Unity is a **separate engine**, not React Native. Using it means either
  rebuilding the app in Unity or embedding "Unity as a Library" via a community RN
  bridge (large — adds hundreds of MB — and fragile). Justified only if world‑anchored
  3D AR (tags that stick in space, virtual furniture, occlusion) is a hard requirement
  and the team adopts Unity as the platform.

### D. Camera + YOLO — **SELECTED**
- Stack: **React Native (Expo dev build)** + **react‑native‑vision‑camera** (layer 1)
  + **react‑native‑fast‑tflite** running a **YOLOv8→TFLite** model (layers 3–4) +
  react‑native‑worklets‑core + vision‑camera‑resize‑plugin; RN views for overlays
  (layer 5); existing `evaluate.ts` / `recommend.ts` (layer 6). The current three.js
  WebView room (`src/three/`) stays as the stand‑in "floor plan".
- Why: real‑time object detection + hazard labels on **any** phone (non‑Pro iPhone
  **and** Android), inside the existing RN app, **no LiDAR**.
- Tradeoff accepted: labels are **2D overlays that track the live view**, not
  world‑anchored in 3D; and there is **no exact 3D floor plan** (that was RoomPlan).

**Bottom line:** LiDAR/Pro was only ever needed for RoomPlan's exact floor plan,
which was dropped. Camera + YOLO gives the core experience on the team's real phones.

---

## 3. What has been built (state at handoff)

Branch: `ar-immersive-scan` (**not committed** — the owner asked to hold commits).

Simulation already in the app (works today in Expo Go):
- 3D "Scan & detect" mode (`src/components/ScanOverlay.tsx`) — simulated live scan.
- Recommendations tab + shopping list (`src/logic/recommend.ts`), off‑limits tagging.

Camera + YOLO scaffolding (the real path):
- `src/live/coco.ts` — COCO‑80 class → hazard‑category (A–N) mapping. **Unit‑tested.**
- `src/live/yolo.ts` — YOLOv8 output decode + non‑max‑suppression. **Unit‑tested.**
- `src/live/LiveScanNative.tsx` — real camera + fast‑tflite YOLO + on‑screen labels +
  "Use findings" → builds an `Assessment` and opens the normal analysis.
  **Reference implementation — NOT yet run on a device.**
- `src/screens/LiveScanScreen.tsx` — shows a "needs the dev build" screen in Expo Go
  (guards the native modules so Expo Go never loads them); loads `LiveScanNative` only
  in a dev build. Entry: Home → "Live AR scan (beta)"; route `LiveScan`.
- Deps installed: `react-native-vision-camera@4.7.2`, `react-native-fast-tflite`,
  `react-native-worklets-core`, `vision-camera-resize-plugin`, `expo-dev-client`,
  `expo-constants`, `babel-preset-expo`.
- `app.json`: vision‑camera + fast‑tflite config plugins. `eas.json`: `development`
  build profile.
- Docs: `docs/AR_NATIVE_PLAN.md` (architecture), `docs/BUILD_DEV_CLIENT.md` (build
  steps), this file.

### Evidence of testing — what IS and ISN'T verified
- ✅ **Verified in the iOS Simulator (Expo Go):** the app still boots after adding all
  the native modules; "Live AR scan (beta)" opens the placeholder, no crash.
  (Screenshots were captured during the session.)
- ✅ **Unit‑tested logic:** `yolo.ts` decode + NMS (two overlapping "knife" boxes →
  collapse to one detection); `coco.ts` weight/energy/barking → band mapping.
- ✅ **Type‑checks clean:** `npx tsc --noEmit`.
- ❌ **NOT verified:** the actual live camera + YOLO detection. It **cannot** be tested
  in the Simulator (no real camera) or Expo Go (no native modules). It needs a physical
  phone + a dev build. Expect first‑run tuning of the model input size / output layout
  (see the notes in `src/live/yolo.ts` and `docs/BUILD_DEV_CLIENT.md`).

### Known gotcha (important for the next person)
Adding `babel.config.js` (needed for the vision‑camera frame processor) **broke Metro
locally** — the local `node_modules` Babel toolchain is incomplete when a root Babel
config is present (Expo supplies its own internally). It was **reverted** to keep Expo
Go working. It must be re‑added for the dev build; **EAS cloud builds do a clean
install and resolve the toolchain on their own**, so they are the low‑friction route.
Details in `docs/BUILD_DEV_CLIENT.md` §1.

---

## 4. Next steps if **Google / ARCore** is selected

Choose this only if the team wants **world‑anchored labels** (tags that stick to real
objects in 3D as you move) and/or **one cross‑platform codebase** across iPhone +
Android. It is an *addition on top of* camera + YOLO, not a replacement.

1. **Keep YOLO for detection.** ARCore does not detect objects — the detection stack
   (`coco.ts`, `yolo.ts`, a TFLite/Core ML model) stays. ARCore only adds tracking +
   anchoring.
2. **Pick the RN AR bridge.** For React Native the practical cross‑platform option is
   **ViroReact** (`@reactvision/react-viro`), which wraps **ARKit (iOS) + ARCore
   (Android)**, plane detection and anchors. Alternatively write a thin native module.
   (Google's "ARCore SDK for iOS" CocoaPod is only needed for Google's *cloud*
   features — Cloud Anchors / Geospatial — which this app does not need; for plain
   indoor anchoring, ARKit on iOS + ARCore on Android is enough.)
3. **Resolve the camera‑session conflict.** ARKit/ARCore and vision‑camera both want
   the camera and can't both own it. So run detection off the **AR session's frames**
   (ARKit/ARCore hand you camera frames) instead of a separate vision‑camera session.
   This is the biggest re‑architecture from the current build.
4. **Anchor the labels.** Pipeline: AR session → camera frame + world tracking → YOLO
   on the frame → for each 2D detection box, **raycast into the world** to get a 3D
   anchor → attach a label node at the anchor so it stays put as the user moves.
5. **Still needs a dev build** (native modules) — same EAS / Mac routes as camera+YOLO
   (`docs/BUILD_DEV_CLIENT.md`). No LiDAR/Pro required.
6. **Effort & advice:** this is a substantial piece (think weeks, not days). Prototype
   the anchor‑a‑label flow on **one** platform first (iOS via ARKit is simplest since
   the team is iOS‑heavy), confirm it feels right, then generalise. If world‑anchored
   3D isn't actually required, the existing **2D camera+YOLO labels already deliver the
   core "walk around, hazards pop up" UX** — don't take on ARCore just for polish.

### Device / account facts for whoever builds it
- **No LiDAR / Pro needed** for any of this (camera+YOLO or ARCore/ARKit).
- A **real phone** is required to test (the Simulator has no camera).
- **Android** dev builds are friction‑free (EAS → APK, free).
- **iPhone** dev builds need a **Mac + free Apple ID** (`npx expo run:ios --device`)
  **or** a **paid Apple Developer account** ($99/yr) for EAS iOS builds.
