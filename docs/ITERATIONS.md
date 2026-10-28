# PawSpace: what changed, iteration by iteration

A look back over the project's git history (161 commits, 10 Sep – 29 Oct 2026), split
into the two prototype iterations. Each iteration is split into **UX / UI changes** and
**logic / accuracy changes**. Logic changes are described in detail because they change
what the app tells people.

| | Iteration 1: first prototype | Iteration 2: refinement after user testing |
|---|---|---|
| Dates | 10 Sep – 15 Sep 2026 | 16 Sep – 29 Oct 2026 |
| Focus | Build the whole flow end to end, then restyle it to the Figma | Fix what testers found confusing, rebuild the logic, redesign the results |
| Branches | `main` | `main` (SDK 57) and `sdk58_upgrade` (SDK 58, for phones) |

Full technical detail of the current logic is in [`docs/LOGIC.md`](LOGIC.md).

---

## Iteration 1: first prototype (10 – 15 Sep)

### UX / UI

**First build (10 Sep): a multi-pet MVP**
- Flow: capture the room → choose a mode → questionnaire → tag items → results.
- A **demo room** so the app could be shown without photos.
- Upload photos or a video as an alternative to the camera.
- A seamless **panorama results map**, plus an experimental **3D room view**.
- Restructured into onboarding plus a **multi-space Home hub** (many rooms per user).

**Spec (13 Sep):** the dogs-only Prototype 1 spec, with three hand-checked breeds
(French Bulldog, Border Collie, Labrador) and worked examples.

**Figma redesign (14 – 15 Sep)**
- New brand: light + orange theme, Mojiw Mochizuki and Goga fonts, new Welcome screen.
- The full Figma flow:
  - Welcome → Create Account / Log In → Getting Started questions → Home;
  - Capture → Review → Flag anything important → Space Saved → Analysis ⇄ Select breed;
  - Profile.
- Analysis screen: a 2D/3D map with risk pins, a "Potential Risks!" sheet, and a cartoon
  dog avatar whose mood follows the result.
- Demo room removed. All buttons 48pt and semibold. `DESIGN.md` written.
- **Capture:** a manual shutter with unlimited photos replaced the automatic sweep.
- **Questionnaire:** bigger controls; dogs-only pets.
- **The Dog API catalogue:** searchable breed dropdowns with photos and breed facts.
- **Navigation and polish:** a glass bottom nav (Home / Upload / Help), slide-up report
  sheet, Re-run pill, and a Profile "Save changes" draft.

### Logic / accuracy (spec §4, version 1)

The first version of the rules (`src/logic/evaluate.ts`) produced three internal bands,
never shown as numbers:

| Part | How it worked |
|---|---|
| **Space adequacy** | An estimated floor area compared with thresholds per size class (small / medium / large). High-energy dogs were bumped up a size class. No outdoor space downgraded the band. |
| **Safety** | A plain **count** of hazards the AI found: 0 = good, 1–2 = adequate, 3+ = poor. Tagged valuables could also lower it. |
| **Noise fit** | A lookup table: the breed's noise level against how close the neighbours are. |
| **Overall** | The **worse** of Space and Safety. This set the dog's mood and the report wording. A "not ready yet" advisory was added on top. |

**Version 1 AI**
- **Gemini room check:** photos and household answers were sent to Gemini, with a
  timeout, a retry, and the built-in example result as a fallback so a demo never
  dead-ends.
- **Breed suggestions:** the rules shortlist the breed catalogue, then Gemini picks and
  explains up to 8 from that shortlist.
- **The Dog API breeds:** energy and barking are *estimated* from the temperament text.

**Known problems carried into iteration 2** (found in the review that became
`PROMPT_LOGIC.md`):
- **Room size never changed:** the floor area was a constant, so every room got the same
  space result.
- **Safety ignored how serious a hazard was:** one cord counted the same as an open
  balcony.
- **Unanswered questions sent as facts:** the AI was told defaults the user never chose.
- **Tags counted as dangers:** valuables and fragile items the user tagged were treated
  as hazards, and counted twice.
- **AI asked for an unused verdict:** the model was asked for a score nobody used.
- **No checking of the AI's reply:** nothing stopped invalid values, and duplicate items
  appeared.
- **Alarming tone and drifting titles:** wording felt alarming, and item titles changed
  between runs.

---

## Iteration 2: refinement after user testing (16 Sep – 29 Oct)

### UX / UI

**Responding to tester feedback (17 Sep – 8 Oct)**
- **Analysis screen:**
  - A delete-scan button.
  - The analysis now only runs once a breed is picked.
  - The dog's speech bubble points at the dog.
- **Capture:** separate upload buttons, an orange Next button, and a Reset button inside
  the camera box.
- **Review and Flag screens:** tap a progress bar to jump to a photo, whole photos with
  side arrows, and pinch to zoom.
- **Flags:** drag a flag to move it; tap it to rename, change type or remove it. Tagged
  valuables show a calm "Be careful" instead of "Needs attention".
- **Report:** a plain verdict card at the top, and flagged items never cut off.
- **Questionnaire:** answers start blank and must all be answered.
- **Space Saved:** "Edit Questionnaire" separated from "Start Space Analysis".

**New features (20 Sep – 15 Oct)**
- **Recommendations tab:** an "Improve" list, a **shopping list**, and **off-limits areas**
  you mark on the photo.
- **Re-run feedback:** a "What's new since your last run" section.
- **"Do you have any other pets?" + "What kind?"** replaced "Do you have a cat?".
- **Removed from `main`:** the AR live scan and the 3D map moved to their own branches,
  out of scope for this prototype.

**Onboarding and first-time experience (15 – 16 Oct)**
- A **step-by-step onboarding questionnaire**, one or two questions per screen. It started
  at 9 steps; it is now 10.
- A **Home walkthrough** that highlights each area, replayable from Help.
- Slide-to-unlock "Get Started".
- Profile: Delete All Data and Log Out as separate buttons.

**Scanning (21 – 22 Oct)**
- **"Scan" wording** throughout:
  - "Scan your Space" and "Scan New Space";
  - "Save Scan" and "Scan Saved";
  - "Start Scan Analysis".
- **How-to guides** with drawn illustrations: How to scan (4 steps) and How to flag (3).
- **Camera:** a rule-of-thirds **grid**, plus **hold-and-sweep** (a photo every 30° of turn).
- **Panorama uploads** are cut into frames.
- **Photo labels:** "Photo X of N" on each photo.
- **Home:** hides scans whose photo no longer loads, and has pull-to-refresh.

**Results redesign: the Results guide steps 1 – 5 (28 Oct)**
1. **Voice and wording:**
   - The dog speaks feelings ("I'd love it here!"); the app speaks steps.
   - No "Not a good fit", "Not safe yet", "Tricky fit", red ✕ or "Potential Risks!".
   - Labels: READY / NEARLY READY / STILL CHECKING / NOT QUITE READY YET, and
     Do first / Worth doing / Nice extra.
2. **Four new results screens:**
   - **Overview:** a photo header with the dog and a headline bubble, a Start here card,
     and five tappable "How I'd feel here" cards.
   - **Things to sort:** a to-do list with filters, photo crops with numbered pins, and
     the shopping list.
   - **Item detail.**
   - **Photo map:** pins on the user's photos; drag sideways or jump pin to pin.
   - Icons, pins and product images come from the Figma.
3. **Special states:** clear screens for an example result (AI busy, off or out of
   quota), unclear photos, and missing routine answers, each with one next step. The
   report is never blank.
4. **Re-check:** a Re-check pill → "Made some changes?" → a "What changed" celebration
   (Sorted 🎉 / Got better / New to sort) → a "Since last time" card.
5. **Breed suggestions:**
   - "Who's moving in?" when there is no dog yet.
   - "Dogs who'd love it here", grouped Great match / Could work / Needs more planning,
     with animated loading dots.
   - A "Meet the breed" preview, so a tap no longer re-runs the analysis by accident.

**Privacy and ethics (28 – 29 Oct)**
- **AI consent sheet**, "Before we check your room":
  - It says what is sent to Google's Gemini and why, and asks people to remove personal
    items first.
  - **Opt out:** nothing leaves the phone, and an example result is shown instead.
  - It is shown **before every analysis**, with a switch in Profile.
- **"Delete this scan"** on the results screens; Delete All Data in Profile.

**Platform (28 Oct):** **Expo SDK 58** on the `sdk58_upgrade` branch, because phones' Expo
Go only supports the newest SDK. `main` stays on SDK 57. Fixes are copied to both.

### Logic / accuracy

#### 1. Suitability logic version 2 (15 Oct): the biggest change

The three bands and "worse of" rule were replaced by **five weighted parts**
(`src/logic/suitability.ts`), with numbers locked from `PawSpace_weightings.pdf`:

| Part | Weight | What it uses |
|---|---|---|
| **Staying safe** | 35% | A **weighted hazard load**: type × severity × the dog's size × the AI's confidence. Poor at a load of 15. Escapes and falls weigh most. |
| **Exercise & company** | 25% | Breed energy against how active the owner is, daily walking time, hours alone, a walker or daycare, and outdoor space actually used. |
| **Room to move** | 15% | The AI's view of the room (openness, a spot for a bed, a clear path), replacing the constant floor area. |
| **Fitting in at home** | 15% | Young children, other pets (chasing), other dogs, first-time owner, a busy home, and the **size of dog wanted** (added 28 Oct). |
| **Neighbours** | 10% | The same noise table as iteration 1. |

- Each part is good (1), adequate (0.5) or poor (0). The weighted blend gives the verdict:
  **Good at 0.80 or more**, adequate at 0.45 or more, otherwise poor.
- **Hard gates:** an escape or fall risk, a toxic item that's hard to move, or an energy
  mismatch can't be hidden by a good average. They cap the verdict.
- **Unknowns never read as good:** if the photos weren't checked or routine answers are
  missing, the verdict can't be "Good fit".
- **No outdoor space** only counts against **high-energy** dogs (the §4.9 fix).
- **API Ninjas 1–5 trait scores** (good with children, other dogs, trainability, shedding)
  feed "Fitting in" where there's no temperament text. API Ninjas is now the preferred
  breed source.

#### 2. A more accurate AI room check

- **New prompt and schema:**
  - The model no longer gives a verdict; the rules own it.
  - It returns a severity rubric, a stable `object_key` per item, escape routes, room
    openness, a retreat spot and a clear path.
  - It also returns setup suggestions: areas to keep out, spots for the dog, and safety
    items to add.
- **Tags fixed:** the user's tags are things to *protect*, pinned where they were placed,
  never counted as dangers.
- **Checking the reply:** `normalise.ts` drops invalid values, merges duplicates, and pins
  every escape or fall item.
- **Unanswered questions** are sent as "not answered", not as defaults.
- **The dog's own traits** (size, energy, noise) are sent as facts.
- **Slippery floors and stairs** always get a pin (21 Oct).
- **Photo check** (21 Oct): the AI first decides whether it can see a room.
  - Blank, dark, blurry or not-a-room photos are flagged with a note.
  - Guessed findings are dropped, and Safety reads "Not checked".
- **Wide photos** are cut, edge to edge, into card-shaped slices (2–6, overlapping 15%).
  The middle of a room is no longer lost off-screen, and in testing more hazards were
  found.
- **Re-runs after an app restart** re-read the saved photos instead of silently using the
  example result.

#### 3. Breed suggestions

- **Size preference** (28 Oct): "What size of dog would you like?" ranks that size first,
  and the AI keeps most picks that size. In testing, every household got breeds of its
  size.
- **Dog's voice:** reasons and plans are written by the dog ("I'm happy with short
  walks…").
- **Allergies, cats and first dogs** are reflected in the AI's "to plan for" lines.

#### 4. Reliability

- **Back-up Gemini models** when the main one is busy (503 / 429).
- **Breed suggestions** pause for 2 minutes after a failure instead of retrying on every
  tab switch.
- **Honest messages:** busy, quota used up, or taken too long.
- **Room check time limit** grows with the number of photos: 30s + 15s per photo, up to
  2.5 minutes. A fixed 30s limit was cancelling checks with several photos. 9 photos now
  finish in about 35s.

#### 5. Testing

- **`npm run check:logic`:** 74 automated checks. They cover the weights, the PDF
  numbers, gates, size preference, photo checks, the to-do list and panorama slicing.
- **Demo households:** three test households (small / medium / large dog) with exact
  questionnaire answers and room photos, run through the real AI in the app.
  - **Small, apartment:** French Bulldog; nearly ready; do first: the balcony.
  - **Medium, family with a cat:** Field Spaniel; nearly ready, 7 things to sort.
  - **Large, active house:** Labrador; ready.
  - Details are in `demo/DEMO_SCENARIOS.md`.

---

## Summary

| Area | Iteration 1 | Iteration 2 |
|---|---|---|
| Verdict | The worse of Space and Safety | 5 weighted parts, hard gates, and unknowns can't be "good" |
| Safety | A count of hazards | Weighted by type, severity, the dog's size and confidence |
| Room size | A constant floor area | The AI's view of openness, a bed spot and a clear path |
| Household | Not scored | Children, pets, experience, home atmosphere, size wanted |
| Exercise | Energy class only | Activity, walking time, hours alone, walker or daycare, outdoor use |
| AI reply | Unchecked | Schema, cleaned up, photo check, stable item IDs |
| Results UX | One report sheet plus a risk sheet | Overview → to-do list → item detail → photo map; encouraging voice |
| Onboarding | One long form | 10 short steps plus a Home walkthrough |
| Privacy | None | Consent before every analysis, an opt-out, delete scan or all data |
| Breeds | 3 built-in plus The Dog API | API Ninjas, size preference, dog-voice suggestions, preview first |
