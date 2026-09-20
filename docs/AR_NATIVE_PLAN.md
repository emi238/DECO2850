# AR immersive scan — native track plan (camera + YOLO)

Status: **planned, not built.** The app currently ships a *simulation* of this
experience (see "What exists today"). This doc is the roadmap for the real,
on-device version and how it slots into what's already there.

## Decision (2026-09-17): camera + YOLO, not LiDAR

The team's phones are **non-Pro iPhones with no LiDAR sensor**, so Apple RoomPlan
is out. We're building the detection experience with the **normal camera + a YOLO
object-detection model running live** — which needs no special hardware and works
on every phone the team has (and Android too).

| Approach | Needs LiDAR? | Runs on team's iPhones? | Gives real-time object detection? | Gives an exact 3D floor plan? |
|---|---|---|---|---|
| **Camera + YOLO (chosen)** | ❌ no | ✅ yes | ✅ yes | ❌ no (keep the generated room) |
| RoomPlan (LiDAR) | ✅ required | ❌ Pro models only | via ARKit | ✅ yes |
| ARCore (Google) | ❌ no | ⚠️ Android-first, weak on iOS | ✅ (Android) | ❌ no |

**What we get:** point the phone around the room, YOLO detects objects on the live
camera, and hazard labels/tags pop up over them as you move — exactly the core of
the brief, on the team's existing phones.

**What we give up vs. LiDAR:** the precise 3D room mesh / floor plan. We keep the
app's current **generated 3D room** (`src/three/scene.ts`) as the stand-in, or later
approximate a room outline from ARKit/ARCore plane detection. (RoomPlan stays a
possible *future* upgrade if anyone gets a Pro device — see the appendix.)

## Still true: this can't run in Expo Go or the Simulator

Live camera + on-device ML needs **native code** and a **development build** (not
Expo Go), tested on a **physical phone** (the Simulator/emulator has no real camera).
So this remains a separate track I can't verify with Simulator screenshots — the
team tests it on a real phone.

## What exists today (the simulation, testable now)

- **3D "Scan & detect" mode** — dynamic, responsive stand-in for the live scan;
  detection labels/tags appear progressively (`src/components/ScanOverlay.tsx`).
- **`src/logic/recommend.ts`** — dog traits + detected hazards → recommendations +
  shopping list (incl. "fence off" items).
- **Recommendations tab** + **off-limits tagging** (2D map, 3D view, and the photo
  tagging step).
- **`src/three/scene.ts`** — the parametric room; the stand-in floor plan.

## Target stack (camera + YOLO)

- **`react-native-vision-camera`** — the live camera, with a **frame processor**
  (runs code on each camera frame).
- **A YOLO model exported for mobile** — YOLOv8/v11 → **TensorFlow Lite** (or ONNX /
  Core ML), run via **`react-native-fast-tflite`** (or a vision-camera detection
  plugin). Start from a pretrained **COCO** model (80 everyday-object classes).
- **`react-native-worklets-core`** — lets the detector run on the frame-processor
  thread without freezing the UI.
- **Detection → hazard mapping** — map YOLO/COCO classes (e.g. `pottedplant`,
  `scissors`, `oven`, `couch`, `stairs`) to our hazard categories A–N
  (`src/ai/categories.ts`).
- **Reused unchanged:** `evaluate.ts` + `recommend.ts` — the whole suitability +
  recommendations "brain" already works off detected objects, so the Recommendations
  tab, shopping list and off-limits tagging keep working.

Keep one interface so the simulated and real detectors are swappable:

```
interface LiveDetector {
  start(): void;
  onDetections(cb: (objs: DetectedObject[]) => void); // {class, bbox, confidence}
  stop(): void;
}
```
- **Today:** a `SimulatedDetector` feeds `ScanOverlay` on a timer.
- **Real:** a `YoloDetector` reads vision-camera frames and runs the TFLite model.

## Milestones

1. **Leave Expo Go → dev build.** `npx expo prebuild` + a dev client. iOS builds
   need a Mac with Xcode **or** Expo's cloud build (EAS) — no Mac required for EAS.
2. **Camera screen.** Add `react-native-vision-camera`; get a live preview on a real
   phone with camera permission.
3. **Bundle a YOLO model.** Export YOLOv8n → TFLite; wire `react-native-fast-tflite`;
   log detections from the live frames.
4. **Map classes → hazards.** COCO class → hazard category; confidence threshold.
5. **Anchor the labels.** Draw detection tags over the camera at each object's box,
   tracking as the phone moves. (`ScanOverlay` already models this UI.)
6. **Wire the logic.** Feed detections into `evaluate.ts` + `recommend.ts`; the
   Recommendations tab, shopping list and off-limits tagging work unchanged.

## Model / licensing notes

- **YOLOv8/v11 (Ultralytics) is AGPL-3.0.** Fine for a uni prototype, but check the
  course's rules before any public distribution. If AGPL is a problem, use a
  permissively-licensed detector (e.g. an MIT/Apache YOLO variant or a TFLite
  MobileNet-SSD COCO model).
- Everything runs **on-device** — no photos leave the phone.

## What you need to start the real track

- Any of the team's phones (no LiDAR needed) for testing.
- A way to make a dev build: a **Mac with Xcode**, **or** an **Expo EAS** account
  (cloud builds, free tier, no Mac needed) + an Apple ID for iOS installs.

## Appendix: RoomPlan (optional future upgrade, LiDAR only)

If anyone later gets a LiDAR iPhone (12 Pro+), RoomPlan can replace the generated
room with a real 3D floor plan: a Swift `RoomCaptureView` Expo module emitting room
geometry + USDZ, populating the same `Scene3D` shape. Not needed for the current
team's hardware.
