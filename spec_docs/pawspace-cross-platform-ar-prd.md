# PawSpace Cross-Platform AR Product Requirements Specification

**Status:** Proposed implementation specification  
**Date:** 11 October 2026  
**Applies to:** Current PawSpace dog-and-cat user-flow specification and Expo SDK 57 application  
**Purpose:** Define a camera-and-motion-based AR architecture and an initial testable concept for ordinary ARCore- and ARKit-capable phones.

---

## 1. Executive summary

PawSpace should remain an Expo / React Native application and use ViroReact over ARKit on iOS and ARCore on Android. AR work requires a custom development build; Expo Go remains useful for non-AR screens and the camera-only fallback, but cannot load the native AR module.

The cross-platform MVP uses standard camera and motion tracking through ARKit/ARCore: horizontal/vertical plane detection, hit tests, and session-local anchors for overlays and item placement. Let users create and correct a lightweight room plan and room boundaries in a 2D editor; use manual measurements or user-confirmed approximate dimensions because AR tracking alone does not provide reliable full-room measurements. This keeps the workflow testable on ordinary supported phones.

**Recommended baseline:** React Native / Expo SDK 57 + ViroReact 2.57.5 or later. Current ViroReact documentation lists support through Expo SDK 57 / React Native 0.86 and provides a shared React Native AR scene API for ARKit and ARCore. Local marker placement requires no external anchor service or API key.

---

## 2. Product goals and non-goals

### 2.1 Goals

- Deliver a camera-based AR walkthrough on supported Android and iOS phones using standard camera and motion tracking.
- Localize user-confirmed tags, highlights, waypoints, and pet-item previews in the physical room during an AR session.
- Support the assessment inputs in the current user-flow spec with measured, user-confirmed, or explicitly unknown values.
- Provide a usable non-AR fallback whenever platform support or tracking is unavailable.
- Begin testing with one ordinary ARCore Android phone and one ordinary ARKit iPhone, without requiring app-store releases.
- Keep qualitative suitability logic, reports, navigation, and persisted app state in the existing React Native layer.

### 2.2 Non-goals for MVP

- Complete automatic house reconstruction, photorealistic meshes, or guaranteed room segmentation.
- Claiming that computer vision finds every hazard or establishes that a home is safe.
- Persistent, cloud/world-scale anchors that survive arbitrary app restarts or transfer between devices.
- Automated determination of all furniture footprints, walkway traffic, door/gate closure, or pet behavior.
- Replacing the existing assessment rules, species profiles, report language, or questionnaire.

---

## 3. Users and platform assumptions

- One account and one household space, per the existing flow.
- Target phones must have ARKit (iOS) or ARCore (Android) support for live AR. ARCore support must be checked against Google's maintained supported-device list.
- No depth camera, depth API, scene mesh, or hardware-specific room scanner is required or used.
- Simulators/emulators can exercise screens, mock AR states, fallback flows, and saved scan data; they cannot validate real camera tracking, plane finding, or anchors.
- Real-device testing is required on both platforms. Use the same test script and capability tiers on both.

---

## 4. Proposed technical architecture

### 4.1 Application layers

1. **React Native product layer**  
   Existing screens, navigation, questionnaire, species/breed profile, qualitative evaluation (`Poor / Adequate / Good`), reports, shopping list, tags/zones UI, avatar presentation, and Zustand/local persistence.

2. **AR scene layer (ViroReact)**  
   Use ViroReact's platform-neutral scene navigator, plane detection, plane selector, scene-local nodes, and anchor callbacks. Keep AR details behind a small PawSpace component boundary.

3. **Native AR implementations inside ViroReact**  
   - iOS uses ARKit world tracking, plane detection, hit testing, and local anchors.
   - Android uses ARCore tracking, horizontal/vertical plane detection, hit testing, and local anchors.

4. **Fallback renderer**  
   Expo Camera plus React Native/SVG overlays, the current three.js/WebView room view, and the current manual/photo/demo capture path. Fallback mode clearly labels estimated or user-entered measurements.

### 4.2 Candidate technology decision

**Preferred evaluation order**

- Use `@reactvision/react-viro` for the shared native AR scene and local plane placement. Current ViroReact documentation lists compatibility with Expo SDK 57 / React Native 0.86.
- Keep PawSpace-specific room editing, tag/zone UX, manual estimates, and item-placement rules in React Native app code.
- Do not enable depth models, cloud anchors, geospatial anchors, or platform-specific room scanning.

**Rendering:** Keep the initial overlays in React Native/SVG layers projected from anchors. Use existing three.js/WebView for the model/preview view, not as the source of AR tracking. A later native 3D renderer may be considered if model occlusion or animation quality requires it; it is not needed to test the core workflow.

**Computer vision:** For the minimum concept, use explicit user tagging and existing image-assessment flow; do not block AR progress on a custom object-detection model. Later, evaluate a cross-platform on-device detector (e.g. TensorFlow Lite via a maintained React Native native integration) or separate Core ML / TFLite models. Any model output is a candidate finding requiring confirmation, with room, image, confidence/provenance, and correction affordances. Do not assume RASSAR's YOLOv5/Core ML model or dataset generalizes to dog/cat hazards.

### 4.3 Data boundary

Persist normalized PawSpace records, not vendor-native objects:

- `SpaceScan`: id, createdAt, platform, capability tier, mode, room ids, optional model reference, user confirmation state.
- `Room`: id, user label, boundary polygon or unknown, floor-area estimate or unknown, measurement source (`ar_estimate | manual | imported | unknown`), confidence/provenance.
- `SurfaceOrObject`: id, room id, category, pose/bounds if available, confidence, optional user label.
- `Tag`: id, room id, optional object/anchor id, category (`valuable | fragile | perch | personal_space | other`), height and source (`estimated | user_adjusted | unknown`), note.
- `Zone`: id, room id, boundary, purpose (`off_limits | personal_space | traffic | other`), closable (`yes | no | unknown`).
- `Finding`: id, room id, category, location reference, source (`user | cv_candidate | rule`), confirmation state, qualitative severity, explanation, suggested fixes.
- `Placement`: catalogue/generic item, room id, pose or 2D location, conflicts, user-approved state.

Raw camera frames/video are transient by default. Persist scan geometry and user-confirmed structured annotations only when the user has opted into retaining the scan. A delete action removes locally persisted scan geometry, anchors, derived findings, and media references.

### 4.4 Spatial accuracy contract

- Every spatial value carries a source and status: measured, estimated, user-entered, or unavailable.
- The UI must not present estimated floor area or object height as precise measurement unless the platform returns supported, calibrated data and the app validates it.
- No automatic map may silently overwrite user edits.
- Tracking loss pauses spatial actions and displays a recovery message. Do not create/modify anchors while tracking is initializing or limited.
- Local AR anchors are session-scoped in MVP. On a later session, relocalize only if explicitly supported and verified; otherwise show saved report/map in 2D and ask the user to rescan/reconfirm positions.

---

## 5. Functional requirements

Priority: **M0** required for the minimum concept; **M1** next; **M2** later enhancement.

### 5.1 Capability and session handling

- **AR-001 (M0):** On app entry, detect OS, native AR support, camera permission, and current tracking state.
- **AR-002 (M0):** Select one of three user-visible modes: `AR available`, `AR available with limited capability`, or `Camera/map fallback`. Explain fallback without blocking the user.
- **AR-003 (M0):** Start only one native AR camera session at a time; stop/pause it when its screen loses focus, the app backgrounds, or the user exits.
- **AR-004 (M0):** Show tracking guidance while initializing/limited (move slowly, improve lighting, point at textured surfaces); disable tap-to-place until tracking is normal.
- **AR-005 (M0):** Handle permission denial, AR service unavailable, unsupported device, camera conflict, and runtime session failure with a recoverable fallback.

### 5.2 Scan and room map

- **AR-010 (M0):** User can start a scan, label a room, end the scan, and review an editable room card.
- **AR-011 (M0):** On AR-capable phones, show camera with detected floor/wall planes and tracking feedback. Capture a room-scale local coordinate frame and available plane/anchor observations.
- **AR-012 (M0):** The app must not claim a complete 3D mesh or fully automatic room segmentation. Store room boundaries and floor dimensions as unknown until the user confirms or enters an estimate.
- **AR-013 (M0):** Provide a simple 2D room outline editor to add/edit rooms, mark door/opening positions, and set an approximate boundary/area. Allow manual measurement entry or mark unknown.
- **AR-014 (M0):** Provide room-level scan status as descriptive coverage states (e.g. `Started`, `Needs another pass`, `Ready to review`); do not imply completeness from percent-covered if no robust coverage metric exists.

### 5.3 Annotation and zones

- **AR-020 (M0):** User can tap a detected plane/object or screen location, create a local anchor when possible, and attach a valuable/fragile tag with name/note.
- **AR-021 (M0):** User can adjust or omit estimated tag height. Record whether height came from the user or an estimate.
- **AR-022 (M0):** User can draw/select an off-limit region on the 2D plan; answer whether the area is closable (`Yes / No / Unsure`). Boundary is editable.
- **AR-023 (M0):** User can mark a dog personal-space floor zone or cat perch/refuge points in the plan. These inputs feed current assessment rules.
- **AR-024 (M1):** Where AR plane hit-testing is reliable, let user confirm zone vertices by tapping the floor; project these into the room plan.
- **AR-025 (M0):** Offer edit, delete, undo, and confirmation controls for every user-created spatial annotation.

### 5.4 Assessment and findings

- **AR-030 (M0):** Pass normalized measurements/annotations and provenance to the existing assessment logic; do not place evaluation rules in native code.
- **AR-031 (M0):** Values not measured or confirmed must be represented as unknown and surfaced for review; do not silently treat unknown as zero hazards, full floor space, or no valuables.
- **AR-032 (M0):** Display candidate computer-vision detections as unconfirmed suggestions. User can confirm, edit, dismiss, or report wrong room/location.
- **AR-033 (M0):** Include the existing hazard-detection disclosure and breed/species limitations wherever assessment output is shown.
- **AR-034 (M1):** Localize confirmed findings to a room-plan location and, where anchor is valid, an AR position.
- **AR-035 (M1):** CV runs on sampled still images or user-captured frames first; continuous per-frame inference is out of MVP due to heat, battery, latency, and validation cost.

### 5.5 Guided walkthrough and AR overlays

- **AR-040 (M0):** Walkthrough lists flagged rooms/findings and can open a camera AR session or 2D walkthrough fallback.
- **AR-041 (M0):** Show a waypoint for the next finding. Without a persistent/relocalizable anchor, guide to the room by label and show the target only when a local anchor is currently valid.
- **AR-042 (M0):** Render a highlight/callout tied to confirmed local anchors for the current AR session; tapping opens the existing finding card with reason and one or two fixes.
- **AR-043 (M0):** Render room boundary/off-limit zone overlays only when room coordinate alignment is reliable; otherwise display the plan in a separate map panel.
- **AR-044 (M0):** Show species avatar emotion and movement state based on the current room tone, plus speech bubble. MVP may use a 2D animated overlay rather than a full 3D animal model.
- **AR-045 (M0):** Enforce prospective-owner not-ready advisory behavior as specified by the user-flow spec; current-owner copy remains improvement-oriented.
- **AR-046 (M0):** Summary report can be opened at all times and remains available when AR is unsupported or tracking fails.

### 5.6 Pet-item placement

- **AR-050 (M0):** User selects a catalogue item or generic placeholder and places it on a detected horizontal plane or in the 2D plan.
- **AR-051 (M0):** Preview can be repositioned/rotated/scaled within a defined range; placement is saved only on explicit confirmation.
- **AR-052 (M0):** Run rule-based conflicts against known room plan/annotations (e.g. overlaps off-limit zone, overlaps marked walkway, bed lacks personal-space area). Unknown geometry yields `Needs review`, not a false pass.
- **AR-053 (M0):** Add confirmed item and explanation to shopping list.
- **AR-054 (M1):** Place simple 3D assets at approximate real-world scale. Do not promise occlusion against physical furniture.

### 5.7 Rescan and data controls

- **AR-060 (M0):** User can rescan a selected room/changed area, review differences, and choose whether prior tags/zones remain, move, or are deleted.
- **AR-061 (M0):** Recompute assessments from confirmed updated values and refresh reports/avatar states; do not report improvement based only on tracking changes.
- **AR-062 (M0):** Provide delete-scan control that deletes saved geometry, annotations, derived AR anchors and local media references.
- **AR-063 (M0):** Raw media is not retained beyond the current capture/analysis session unless the user explicitly enables retention.

---

## 6. UX flow for full implementation

1. **AR readiness check:** explain camera use; detect support and permissions; proceed in AR or fallback mode.
2. **Scan instructions:** encourage slow movement, good lighting, and views of walls/floor; describe limitations in plain language.
3. **Room capture:** scan one room at a time; show plane/tracking cues; user labels room and finishes it.
4. **Review room map:** edit outline and dimensions, or mark them approximate/unknown. Add opening/door details as needed.
5. **Tag and define zones:** tap-to-tag items; adjust height; draw off-limit zones; answer closability; mark pet resting/perch zones.
6. **Assess:** combine known inputs with questionnaire and breed/species profile. Ask for correction when required values are unknown.
7. **AR walkthrough:** choose a room, follow waypoint, inspect confirmed finding highlights, view animal avatar/callouts, open report at any time.
8. **Placement:** choose item, preview in AR or plan, review conflicts, confirm, add to list.
9. **Rescan:** select changed room, capture/review updates, reconcile old annotations, rerun logic.
10. **Data settings:** inspect retention and delete scan.

---

## 7. Minimum concept to begin testing (M0 AR spike)

### 7.1 Purpose

Prove that PawSpace can build and run a native AR development client on one Android phone and one iPhone, display tracking/planes, place a local marker, and retain a simple room/tag record. This spike deliberately does not claim automated room measurement or hazard detection.

### 7.2 Included vertical slice

- Add Expo development-client workflow while retaining Expo Go for ordinary UI work.
- Use the ViroReact AR scene behind a small PawSpace screen boundary.
- Create one `AR Test` screen with capability status, camera permission, tracking state, horizontal plane visualization, tap-to-place one colored marker, marker label, reset-session button, and fallback route.
- Create one minimal `Room review` screen: room name, manual approximate width/length or unknown, `Save room`, and a 2D outline.
- Create one annotation flow: tap/place marker, assign `valuable` or `fragile`, name it, optionally enter height, save/edit/delete.
- Display one anchored callout during the same AR session and a list/map fallback when the session ends.
- Run the existing qualitative evaluation against a manually entered test fixture and show the resulting room summary.
- Provide a deterministic demo mode for simulator and unsupported hardware with mocked planes, tracking states, and anchors.

### 7.3 Explicitly excluded from the spike

- Automatic room segmentation, full-house meshes, continuous object detection, persistent anchors across app restarts, multiroom registration, production pet avatars, item catalogue, and real shopping integrations.

### 7.4 Acceptance criteria

- **MVP-1:** Development client builds and opens on one ARCore-supported Android phone and one ARKit-capable iPhone.
- **MVP-2:** Each device reports AR support correctly; a camera/map fallback is available when AR is unsupported.
- **MVP-3:** User sees tracking state and a recoverable unsupported/permission-denied fallback.
- **MVP-4:** After tracking reaches normal, user can tap a detected floor plane and place a marker that remains visually stable while slowly moving around the same room.
- **MVP-5:** Tapping the marker opens the same tag editor on both platforms; user can save, edit, and delete the tag.
- **MVP-6:** Closing AR preserves the normalized room/tag data locally; reopening shows the 2D record and does not pretend that the old anchor has relocalized.
- **MVP-7:** The manually entered/unknown room dimensions feed the current assessment path without fabricating automatic measurements.
- **MVP-8:** Simulator/demo mode can exercise the full UI and failure states without AR hardware.
- **MVP-9:** The test is repeatable in a short team checklist and includes device model, OS, AR support, lighting, tracking state, and observed failures.

### 7.5 Test checklist

For each platform/device:

1. Fresh install; grant camera, then repeat with camera denied.
2. Launch in bright, normally furnished room; wait for normal tracking.
3. Tap visible floor; place marker; walk slowly in a small loop; record drift/loss.
4. Tap marker; save, edit, and delete a valuable tag.
5. Pause/resume app; confirm session recovery/fallback is clear and no stale anchor is shown as valid.
6. Disable/unsupported AR path using mock or device capability; confirm camera/map fallback.
7. Enter known dimensions, run assessment fixture; repeat with dimensions unknown and verify copy distinguishes unknown from adequate.
8. Delete the scan and verify room annotations and media references are removed.

---

## 8. Build, test, and release strategy

### 8.1 Development

- Continue `npx expo start` / Expo Go for UI-only iterations and mock mode.
- Install `expo-dev-client` and create an Expo development build for native AR work. Rebuild the client after native module, config plugin, permission, or native configuration changes. Ordinary TypeScript/UI edits continue through Metro without a full native rebuild.
- Use EAS Build if the team's computers cannot build both platforms locally; otherwise use local Android tooling and Xcode for the corresponding platform. iOS physical-device signing is an Apple provisioning constraint.
- Maintain a development build per platform and a short real-device smoke test after native changes.

### 8.2 Test tiers

- **Tier 0 – unit/data:** normalized spatial schema, room rules, assessment outputs, unknown-value handling, persistence/delete.
- **Tier 1 – simulator/mock:** navigation, overlays, 2D editor, permissions/failure states, AR event playback, 3D preview.
- **Tier 2 – physical AR:** tracking, plane detection, hit tests, anchors, pause/resume, fallback; at least one Android and one iOS phone.

---

## 9. Risks and mitigation

| Risk | Mitigation |
|---|---|
| ViroReact build or runtime incompatibility | Keep the AR experience isolated behind the PawSpace AR screen; resolve native build issues before expanding feature scope. |
| ARKit/ARCore tracking behavior differs | Normalize events/capabilities; test both platforms and degrade gracefully. |
| Room geometry is too weak for automatic area/furniture claims | Make room outline and key dimensions user-confirmed/manual in M0; label provenance and uncertainty. |
| Anchor drifts or is lost between sessions | Scope anchors to active session; store plan coordinates and annotations; require visual reconfirmation after relaunch/rescan. |
| CV misses hazards or produces false positives | Best-effort disclosure; suggestions require user confirmation; prioritize user tags and edit controls. |
| AR distracts from accessible/usable assessment | Always offer 2D map/report; preserve qualitative language; do not require AR to understand findings. |
| Device, light, or texture limits tracking | Coach user; report tracking quality; retain manual/map fallback. |

---

## 10. Decisions and open questions

### Decisions for this specification

- Expo remains the application framework; native AR is added through an Expo development build.
- Both iOS and Android use ViroReact scenes backed by ARKit/ARCore.
- M0 geometry is approximate/user-confirmed; standard camera/motion AR devices are the baseline.
- Expo Go remains a UI/demo environment, not the AR runtime.

### Validate before implementation commitment

- Does ViroReact 2.57.5+ build and run on the team's exact SDK 57 devices and Android build environment?
- Which Android and iPhone models are available to the team, and are they on Google's ARCore supported list / ARKit-supported OS versions?
- Should the first deliverable remain dogs-only (prototype spec) or follow the current dog-and-cat flow? The AR substrate supports either, but acceptance fixtures and annotation vocabulary differ.
- What minimum spatial precision is necessary for assessment? Current qualitative rules should treat dimensions as approximate/user-confirmed until validated.
- Is on-device detection expected in the student prototype, or are user tags and photo-based assessment sufficient for the first iteration?

---

## 11. Reference material

- PawSpace current flow and evaluation: `spec docs/pet-space-ar-app-user-flow-spec.md`.
- PawSpace dogs-only prototype: `spec docs/pawspace-prototype1-dogs-only.md`.
- RASSAR source repository (referenced for scanning and feedback workflow): https://github.com/makeabilitylab/RASSAR
- Expo development builds: https://docs.expo.dev/develop/development-builds/introduction/
- Expo custom native code: https://docs.expo.dev/workflow/customizing/
- ARCore development and supported devices: https://developers.google.com/ar/develop and https://developers.google.com/ar/devices
- ViroReact Expo guide: https://viro-community.readme.io/docs/integrating-with-expo

