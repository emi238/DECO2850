# PawSpace logic: how suitability is decided

**The single logic document for PawSpace.** It merges the v2 spec
(`PawSpace_CHANGE_PRD_logic_v2.md`, 15 Oct 2026) with the earlier `PROMPT_LOGIC.md`;
both are superseded by this file. Everything here describes what is **built** on branch
`main` and was checked against the code: the two prompts are copied
from the source, and the rules are covered by `npm run check:logic`.

It explains, end to end, how the app goes from room photos + questionnaire to "is this
space suitable for this dog?", what the AI is asked, what the app does with the answer,
where the build differs from the PRD, and what is still weak.

**Changelog**
- **15 Oct 2026, 3D map removed:** `main` now shows the 2D photo map only. The 3D room
  view, its 2D/3D toggle and its "Add off-limits area" button are gone, and so is the
  `react-native-webview` package. The 3D map is kept on the **`feature/3d-map`** branch.
  Off-limits areas are added on photos only (§4.14).
- **15 Oct 2026, consolidated on `main` (AR removed):** all the logic work was copied
  from `feat/native-ar-foundation` to `main` without the AR prototype. Also brought in
  from the other branches: **API Ninjas** as the preferred breed source (its 1–5 scores
  now feed the household check, §4.5), **owners can set their own dog's size**, the
  **§4.9 fix** (outdoor space counts only for high-energy dogs, §4.3), the
  **Recommendations tab** (Improve + Shopping, §4.13) and **off-limits tagging** (§4.14).
  The 3D "Scan & detect" overlay was left out on purpose. Expo packages updated to the
  SDK 57 versions.
- **15 Oct 2026, other pets:** "Do you have a cat?" became **"Do you have any other
  pets?"** plus "What kind?" (cat, bird, rabbit/guinea pig or similar, fish, reptile,
  other; pick all that apply). Saved cat answers convert automatically
  (`src/logic/migrate.ts`). A breed known to chase now counts as a household concern
  with a cat, bird **or** small animal (§4.5). Both prompts get the list, and the room
  prompt has guidance for each type (§2.4).
- **15 Oct 2026, merged:** the PRD v2 and `PROMPT_LOGIC.md` combined into this file
  (renamed from `docs/PROMPT_LOGIC.md`). Added the plain-English summary, the weighting
  design note, the master variable table, the acceptance-criteria status (§9), where the
  build differs from the PRD (§10) and out of scope (§11). **Clear path now counts** in
  the Room score (§4.4): the PRD summary lists it, but it hadn't been built.
- **15 Oct 2026, What's new:** after a Re-run the report has a collapsible "What's new
  since your last run" section (§4.11), replacing the paragraph box removed earlier.
- **15 Oct 2026, Suggested setup:** the room prompt now also suggests where to keep the
  dog out, good spots for its bed/crate/bowls/play, and safety to add (gates, railings,
  netting, window guards…), each placed on the photo. Shown as a "Suggested setup" card
  in the report and as labelled pins on the map (§2.2, §4.10). Doesn't affect the verdict.
- **15 Oct 2026, later:** removed the "Updated just now" box from the report at the
  team's request. Re-run now just reopens the updated report (§4.11).
- **15 Oct 2026, logic v2** (from `PawSpace_CHANGE_PRD_logic_v2.md`): the fixed-room
  Space rule is gone. Suitability is now five weighted sub-scores with
  photo-derived signals at 50%, a confidence-weighted Safety load, hard gates, and
  "unknown" handling. New dogs-only room prompt enforced by a Gemini `responseSchema`.
  Eight new questionnaire questions. New report rows, "What to change", profile
  nudges, and off-limit callouts on the map. Fixes W2 and W4–W13; W1 is partly fixed.
- **14 Oct 2026:** children at home and hours alone added to the questionnaire and both
  prompts; only answered questions sent (W3); Re-run shows what changed.
- **11 Oct 2026:** first version.

---

## How the logic works (in short)

PawSpace splits the work between the AI model and fixed app rules, so no single black
box decides suitability. The model's job is **perception, not judgement**: it reads the
room photos and returns *what is there and where*. That means hazards with a location,
severity and confidence, plus qualitative space cues such as openness, a retreat spot
and a clear path. It never decides "suitable or not". (Object detection would ground its
findings further, but none is built yet; see §1.1.)

The verdict is computed by the rules. They combine the model's findings with the breed's
traits (size, energy, noise) and the household questionnaire into five weighted
sub-scores. Because the room scan is the product's differentiator, **photo-derived
signals carry half the verdict** (Safety 35% + Room to move 15%), and questionnaire-driven
fit factors make up the rest. Two safeguards keep that honest: every finding carries a
confidence level, and low-confidence findings count at half weight. On top of the weighted
blend sit **hard gates**: a serious escape or fall risk, a toxic item that's hard to fix,
or a severe energy mismatch caps the verdict however good the average looks. Anything the
app couldn't check also stops a "Good fit". The user only ever sees words, never numbers.

| Sub-score | Weight | Source | What's inside it |
|---|---|---|---|
| **Safety** | **35%** | Photos | Weighted load of hazards by type: escape/fall (highest) · toxic/ingestible · electrical/thermal · floor/stairs · fragile/valuable · clutter. Scaled by dog size (large → fragile, floor and escape count more; small → squeeze gaps and swallowable objects count more) and by confidence (low ×0.5). User-tagged valuables excluded. (§4.2) |
| **Energy & management fit** | **25%** | Breed + questionnaire | Breed energy vs owner capacity: owner activity, daily exercise time, outdoor space and whether it's used, hours alone and any walker or daycare. The research-backed make-or-break factor. (§4.3) |
| **Room to move** | **15%** | Photos (qualitative) | Openness, retreat spot, clear path. Floor area (m²) only counts at medium+ confidence. Bites mainly for large or high-energy dogs. (§4.4) |
| **Household fit** | **15%** | Questionnaire + photo cross-check | Young children (+ retreat spot), other pets (cat, bird, small animal), other dogs, first-time owner, a busy home, the size of dog wanted, each against the breed's size, energy and temperament. Photos cross-check the answers. (§4.5) |
| **Noise fit** | **10%** | Breed + questionnaire | Breed vocalness vs neighbour proximity (attached / close / not close). (§4.6) |

**What the model focuses on:**
- hazards by category, each pinned on the 2D map with a severity and confidence;
- the room as a place to live: openness, retreat spot, clear path, floor type;
- escape routes;
- suggested setup: keep-out areas, good spots for the dog's bed/crate/bowls/play, and
  safety to add, such as gates, railings and netting;
- specific improvements;
- detected signals (pets, children, dwelling, outdoor space) that cross-check the
  questionnaire.

It treats the breed traits and questionnaire answers as facts, reasons only about *this*
room, isn't allowed to judge breeds on stereotype, and never outputs a score or verdict.

**Verdict:** the weighted blend of the five sub-scores becomes a word band ("Good fit /
Good fit with a few changes / Not a good fit yet"). Then the hard gates and caps apply,
and a plain list says what to change.

---

## 0. Where the logic lives

| What | File |
|---|---|
| Suitability rules: weights, formulas, gates, unknowns, cross-check | `src/logic/suitability.ts` (pure logic, no app code) |
| "What's new" comparison after a Re-run | `src/logic/changes.ts` (pure logic) |
| Converting answers saved by older versions (e.g. the old cat question) | `src/logic/migrate.ts` (pure logic) |
| Words the user sees: verdict, chips, lines, "What to change", nudges | `src/logic/evaluate.ts` |
| Room prompt text | `src/ai/prompt.ts` |
| Output contract: allowed values + Gemini `responseSchema` | `src/ai/schema.ts` |
| Building and sending the request | `src/ai/gemini.ts` (retries + fallback in `src/ai/assess.ts`) |
| Checking and cleaning the model's reply | `src/ai/normalise.ts` |
| Sample assessment (AI off or failed) | `src/ai/mock.ts` |
| Breed suggestions (rules shortlist + breed prompt) | `src/ai/breedSuggest.ts` |
| Breed data: API Ninjas (preferred), then The Dog API, then 3 built-ins | `src/logic/dogsApi.ts`, `src/logic/dogApi.ts`, `src/logic/breeds.ts` |
| Recommendations (Improve) and Shopping lists | `src/logic/recommend.ts` (pure logic) |
| Questionnaire questions and types | `src/components/HouseholdForm.tsx`, `src/types.ts` |
| Report and map UI | `src/screens/AnalysisScreen.tsx` |
| Acceptance checks (PRD §9) | `scripts/check-logic.mjs`, run with `npm run check:logic` |

---

## 1. The big picture

The final "suitable or not" answer is **decided by the rules, not the AI**. The AI looks
at the photos and reports findings; the rules weigh those findings together with the
questionnaire and the breed's traits.

```
 Photos (≤10) ─┐                                 hazards (object_key, type, severity, confidence, pin)
 Household ────┼─► [1] ROOM PROMPT ─► normalise ─► room_assessment, escape_routes,
 Dog traits ───┤    (Gemini + schema)               off_limit_suggestions, detected_signals,
 Tags ─────────┘                                    improvements
                                                              │
 Dog traits + household ───────────────────────► [2] RULES (suitability.ts)
                                                     Safety 35% · Energy 25% · Room 15%
                                                     Household 15% · Noise 10%
                                                     → blend → hard gates → caps → verdict
                                                              │
                                                              ▼
                                               evaluate.ts → words on screen (no numbers)

 "Explore breeds": every catalogue breed → RULES rank them → top 30 → [3] BREED PROMPT → up to 8
```

| # | Prompt | File | Model settings |
|---|---|---|---|
| 1 | Room assessment (`SYSTEM_PROMPT`) | `src/ai/prompt.ts` | `gemini-3.6-flash`, temperature 0.4, JSON with `responseSchema` |
| 2 | Breed matchmaker (`BREED_SUGGEST_PROMPT`) | `src/ai/breedSuggest.ts` | same model, temperature 0.5, JSON (no schema) |

If real AI is off, the key is missing, the photos aren't in memory (after an app
restart), or all 3 attempts fail, the **sample assessment** (`mock.ts`) is used. It can't
see the photos, so the rules treat Safety and the room as **unknown** (§4.8), not as safe.

### 1.1 Pre-flight results (PRD v2 §1)

- **Object detection: not present.** No YOLO/TFLite/ONNX/Core ML/ML Kit
  dependency, model file or code. The only detection code is a YOLOv8 decoder on the
  `ar-immersive-scan` branch (`src/live/yolo.ts`, `coco.ts`), which has never run on a
  device and has no model file. So logic v2 uses the **LLM-only path**: model-estimated
  pins with confidence discounting. PRD §7 (detection grounding) is **not implemented**.
  - **Recommended next accuracy upgrade:** a lightweight detector, either on-device
    YOLO11n/YOLOv8n via TFLite or Core ML, server-side ultralytics/onnxruntime in the
    proxy, or hosted Roboflow. It would give exact pins and "high" confidence for
    detected objects, raising Safety and Room reliability from moderate to high and
    fully justifying the 50% photo weighting.
- **Fixed room size: confirmed live before this change.** Every room was
  16 / 8 / 4 / 0 m², so the open-floor ratio was always 0.50. That rule and
  `estimateMetrics` are now removed and replaced by the qualitative Room score (§4.4).

---

## 2. Prompt 1: room assessment

### 2.1 What gets sent

**Where the photos come from** (`CaptureScreen.tsx`, `src/capture/`): camera shots (tap the
shutter; a rule-of-thirds grid helps line them up), **hold and sweep** (hold the shutter
and turn: the gyroscope takes a photo every 30° of turn, up to 360°; real phone only),
uploaded photos, or frames sampled from a video. An uploaded **wide photo** (wider than
1.4:1, e.g. 16:9) is cut into two overlapping halves, and a **panorama** (wider than 2:1)
into 2 to 6 overlapping 4:3 slices, left to right (`panorama.ts`), so the photo cards
(which are portrait) show the whole room and the pins land on normal-shaped frames. At most 10 frames are kept.

One request with three parts in a single `user` turn (`gemini.ts → callGemini`):

1. The system prompt (§2.4).
2. `CONTEXT:` + JSON:
   ```json
   {
     "dog": { "breed": "Labrador Retriever", "size": "large", "energy": "moderate", "noise": "quiet" },
     "household": {
       "dwelling": "apartment", "rental": true, "neighbours": "attached",
       "outdoor_access": "balcony", "outdoor_use": "sometimes",
       "children_at_home": "young", "hours_alone": "4_to_8", "alone_plan": "none",
       "owner_activity": "moderate", "exercise_time": "30_60", "experience": "none",
       "household_atmosphere": "mixed", "allergies": false,
       "existing_pets": { "dogs": [], "other": ["cat", "bird"] }
     },
     "tags": [ { "id": "tag_1", "label": "Vase", "note": "Fragile", "frame": 0, "x": 0.3, "y": 0.6 } ],
     "off_limit_areas": [ { "label": "Kitchen", "frame": 1, "x": 0.5, "y": 0.5 } ]
   }
   ```
   - `dog` comes from the app's breed data (catalogue or mixed-breed answers) and is
     ground truth.
   - `household` holds only the questions the user answers. Unanswered ones are sent as
     `"not_answered"`; `outdoor_use` is `"not_applicable"` when there's no outdoor space.
   - Tags now include their **id and x, y**, so tagged items are pinned where the user
     put them.
3. Up to 10 photos (base64 JPEG, about 1024 px wide).

### 2.2 The output contract (`schema.ts`)

The model must return JSON matching `ROOM_RESPONSE_SCHEMA`. Every field and allowed
value is defined once in `schema.ts` and used by both the request and the normaliser.

| Field | Values | Used by |
|---|---|---|
| `hazards[]` | `object_key`, `title`, `source` (photo / user_tag), `hazard_type` (escape_fall / toxic_ingestible / electrical_thermal / floor_stairs / fragile_valuable / clutter / other), `category` (A–N), `scope`, `location`, `risk_to`, `severity`, `confidence`, `small_dog_risk`, `easy_fix`, `tag_id`, `evidence`, `why_it_matters`, `recommendation` | Map pins, risk cards, Safety load, gates |
| `room_assessment` | `openness` (open/moderate/cramped), `retreat_spot` (present/possible/absent), `clear_path`, `floor_type`, `floor_area_m2` {value, confidence} | Room score, Household (retreat), report chips |
| `escape_routes[]` | type (balcony/window/door/fence/stairs), position, severity, confidence | Safety load, escape gate |
| `off_limit_suggestions[]` (up to 3) | zone (kitchen/balcony/nursery/office/stairs/other), reason, frame, x, y | Suggested setup: "Keep the dog out" |
| `dog_spots[]` (up to 3) | purpose (bed/crate/food_water/play), reason, frame, x, y | Suggested setup: "Good spots for the dog" |
| `safety_additions[]` (up to 5) | type (gate/railing/netting/window_guard/pen/cord_cover/non_slip_mat/other), detail, reason, frame, x, y | Suggested setup: "Safety to add" |
| `detected_signals` | existing_pets, children, dwelling_cue, outdoor_access_cue | Profile nudges; fills an unanswered "has a cat" |
| `improvements[]` | up to 5 strings | "What to change" |
| `space_summary`, `confidence`, `notes` | text | Breed prompt |

Removed: `mode`, `suitability` (verdict and `score_0_100`) and `recommended_pets`. The
rules own the verdict and no score exists anywhere (W2).

**If the API rejects the schema** (HTTP 400, for example "schema too complex"),
`gemini.ts` asks once more without it. The prompt describes the same shape and the
normaliser checks every value either way. A fake-API check covers this.

> **Not yet verified live.** On 15 Oct 2026 the schema couldn't be tested against the
> real API: Gemini returned "503, high demand" on all 10 attempts over about 10 minutes.
> Re-test with one real capture when Gemini is available (see N6).

### 2.3 What `normalise.ts` does with the reply

- **Drops** any finding whose category isn't A–N, and any escape route of an unknown
  type, instead of silently turning them into something else (W11).
- **Defaults** missing values: confidence → `low`, openness → `moderate`,
  retreat_spot → `possible`, floor area → `null`, signals → `unknown`.
- **Clamps** pins to 0–1. A missing pin goes to the centre of frame 0 and becomes `low`
  confidence.
- **Escape/fall findings filed as whole-room** are turned into pinned objects with `low`
  confidence (W7). **Slippery floors and stairs** get the same treatment, with the pin
  placed low in frame 0 (y = 0.85), where the floor is.
- **Photo check:** if the model reports `photo_check.usable: false` (blank, black, too
  dark, blurry or not a room), every photo finding, escape route, setup suggestion and
  improvement is dropped (only the owner's own tags remain). Scoring then treats the
  photos as **not checked**, exactly like the sample assessment: Safety reads "Not
  checked", the verdict can't be "Good fit", and the Analysis screen shows the model's
  one-line note (e.g. "The photos are almost black…") in a red banner and in the report.
  A reply without `photo_check` counts as usable.
- **Merges duplicates**: one entry per `object_key`, keeping the stronger report (W8/W9).
- **Tags** (W5): every tag appears exactly once, as `source: "user_tag"`,
  `risk_to: "home"`, pinned at the tag's own x, y. A tag the model left out is added. A
  photo finding that is really the tagged item (same key, or a fragile/valuable finding
  within 0.12 of the tag on the same photo) is folded into it.
- **Suggested setup** entries need an allowed kind and a reason (others are dropped),
  are capped at 3 / 3 / 5, and keep their x, y only if the model gave both; without a
  position they're listed in the report but not pinned.
- `easy_fix` counts as "no easy fix" **only when the model says so explicitly**. This
  keeps the toxic gate from firing on missing data.

### 2.4 The system prompt, verbatim

```text
You are PawSpace's home-safety assessor for DOGS. You look at photos of ONE room in someone's home, with facts about the dog they are considering and about their household. You report what in this room could hurt the dog or let it escape, what the dog could damage, what the room is like for this dog to live in, and specific changes that would help.

You do NOT decide whether the home suits the dog. PawSpace's own rules make that decision from your findings, so report accurately: do not exaggerate or play things down, and never give a score, rating, percentage or overall verdict.

INPUTS (the CONTEXT JSON and the photos)
1. PHOTOS: photos of the same room, 0-indexed, in no guaranteed order (a sweep, separate shots or frames from a video). The same object can appear in several photos: report each physical object ONCE, in the photo where it is clearest. Report only what you can see or what is strongly implied by what you see. Never invent objects.
2. DOG ("dog"): breed, size (small = under 12 kg, medium = 12-25 kg, large = over 25 kg), energy (low / moderate / high) and noise (quiet / moderate / vocal). Treat size, energy and noise as ground truth, even where they differ from what you expect of the breed. Judge this room for this dog; never penalise a breed on stereotype.
3. HOUSEHOLD ("household"): the owner's own answers. Treat them as facts. "not_answered" means unknown: do not assume either way. Nothing else about the household is known.
   - dwelling: apartment / house. rental: true / false.
   - neighbours: attached / close_separate / not_close.
   - outdoor_access: none / balcony / shared yard / private yard / pool. outdoor_use: most_days / sometimes / rarely (how often the dog would use it).
   - children_at_home: none / young (a child under 5) / older (5 or older).
   - hours_alone: under_4 / 4_to_8 / over_8 (a typical day). alone_plan: none / walker / daycare.
   - owner_activity: sedentary / moderate / active. exercise_time: under_30 / 30_60 / over_60 (minutes of walks and play a day).
   - experience: none (first dog) / some (has owned a dog before).
   - size_preference: small / medium / large / any (the size of dog they would like; the dog's own size is in "dog").
   - household_atmosphere: calm / mixed / busy.
   - allergies: true / false (someone at home is allergic to pets).
   - existing_pets: dogs (breeds already in the home) and other (other pets in the home: cat / bird / small_animal = rabbit, guinea pig or similar / fish / reptile / other; an empty list means none).
4. TAGS ("tags"): objects the owner marked themselves, each with id, label, note ("Valuable" or "Fragile"), frame, x and y. They are things to PROTECT FROM the dog, not dangers to the dog.
5. OFF-LIMITS AREAS ("off_limit_areas"): areas the owner has already decided the dog will not be allowed into, each with label, frame and x, y (frame null = not tied to a photo). Do not repeat them in off_limit_suggestions. If you can see no way to close one off (a door or a gate), add a safety_additions entry for it (gate, or pen for an open-plan area).

WHAT TO RETURN

hazards: one entry per physical object or place.
- object_key: a short, stable, lowercase name for the physical object, such as "tv-power-cord", "balcony-door" or "plant-on-side-table". Use the same key wherever the object appears.
- title: 2 to 5 plain words naming the object and where it is, such as "Cord behind the TV". Keep the same title for the same object.
- source: "photo" for anything you found; "user_tag" only for an owner's tag.
- hazard_type:
  escape_fall: a way out or a fall: balcony railings or gaps, openable or unscreened windows, doors to outside, fence gaps, furniture the dog could climb to reach a window, ledge or railing or jump from and get hurt, an unfenced pool.
  toxic_ingestible: toxic plants, chemicals, cleaning products, medicines, food within reach, small objects the dog could swallow.
  electrical_thermal: cords, cables, chargers, heaters, fireplaces, hot surfaces.
  floor_stairs: stairs, steps, slippery hard floors (mainly a risk for large or older dogs).
  fragile_valuable: things the dog could break or damage (a risk to the home).
  clutter: loose things at dog height that need managing (shoes, cushions, bins, toys).
  other: a finding that is not a physical danger (room size, noise, how the dog fits the household).
- category: the matching CHECKLIST letter.
- scope: "object" for anything you can point to in a photo; "space" only for whole-room findings. Escape and fall findings are ALWAYS "object" with a location. Slippery floors, stairs and steps are also ALWAYS "object": point at the floor or the stairs in the photo where they show most clearly.
- location: for "object", frame_index plus x and y from 0 to 1 across the original photo (0,0 = top-left) and, if you can, bbox [x, y, w, h]; null for "space".
- severity:
  high = could seriously injure or kill the dog, or let it escape.
  medium = likely to injure the dog or cause damage.
  low = a nuisance.
- confidence: high = clearly visible; medium = partly visible or fairly sure; low = inferred, partly hidden, or a measurement.
- small_dog_risk: true only for a gap a small dog could squeeze through or an object small enough for a small dog to swallow.
- easy_fix: true if it can be fixed quickly and cheaply (move it, put it away, tidy or cover a cord, close a door); false if it needs building work, a bigger purchase or ongoing management.
- tag_id: the tag's id for "user_tag" entries, otherwise "".
- risk_to: animal / home / both.
- evidence: what you saw.
- why_it_matters: one sentence on why it matters for this dog in this household.
- recommendation: one specific change, such as "move the plant from the low side table to a high shelf", not "remove toxic plants".

For EVERY tag, return exactly one hazards entry with source "user_tag", tag_id set to the tag's id, risk_to "home", hazard_type "fragile_valuable", location set to the tag's frame and its x and y, and a recommendation on protecting the item. Never describe a tagged item as a danger to the dog.

room_assessment: the room as a place for this dog to live.
- openness: open (plenty of clear floor for this dog to move and play) / moderate / cramped (little clear floor for this dog).
- retreat_spot: present (a dog bed or crate is already there) / possible (a quiet corner out of the way where one could go) / absent.
- clear_path: good / partial / poor (can the dog move through without squeezing past furniture?).
- floor_type: hard / mixed / soft / unknown.
- floor_area_m2: your estimate of the floor area with a confidence; value null if you cannot tell. Photo measurements are rough: use confidence low unless an object of known size (a standard door, a sofa) gives clear scale.

escape_routes: every way out or fall point you can see (balcony, window, door, fence, stairs), with the same object_key as its hazards entry, type, detail, frame_index, x, y, severity, confidence and small_dog_risk. Each one also appears in hazards with hazard_type "escape_fall" (or "floor_stairs" for stairs).

SUGGESTED SETUP: practical suggestions for setting this room up for this dog, each placed where it applies: frame_index plus x and y (0 to 1 across the original photo) at the spot itself. Only suggest places and fixes you can see in the photos.
- off_limit_suggestions (up to 3): areas this dog should be kept out of (kitchen, balcony, nursery, office, stairs, other), each with a one-sentence reason.
- dog_spots (up to 3): good places for the dog's things. purpose: bed (a quiet corner away from doors, foot traffic, hazards, heaters and direct sun), crate (the same, out of the way but within sight of the family), food_water (a wipe-clean floor, away from the bed), play (clear open floor away from fragile things). Suggest a bed spot even when retreat_spot is "possible", and say why that spot works.
- safety_additions (up to 5): things to add or fit, each tied to something you can see: gate (doorways, stairs, kitchen, or to separate a young child's play area), railing (to close gaps in a railing or an open edge the dog could fall from), netting (balcony gaps a dog could squeeze through), window_guard (low or openable windows), pen (a safe zone for time alone), cord_cover (exposed cords), non_slip_mat (slippery floors in the dog's path), other. detail says exactly what and where, such as "clear acrylic panels along the lower half of the balcony railing". If household.rental is true, prefer options that need no drilling (pressure-fit gates, removable netting, adhesive cord covers).
Each reason is one sentence of at most 25 words.

photo_check (decide this FIRST, before anything else): can you actually see a room?
- usable: false if every photo is blank, black or nearly black, too dark or too blurry to make out the room, or shows no indoor room (a screenshot, a close-up of one object, a landscape). One or two bad photos among good ones are fine: usable true.
- issue: none / blank / too_dark / blurry / not_a_room.
- note: one plain sentence telling the owner what to retake, such as "The photos are almost black, so turn the lights on and take them again."; empty when usable.
When usable is false, do not guess: return empty hazards, escape_routes, off_limit_suggestions, dog_spots, safety_additions and improvements, and use the most cautious room_assessment values.

detected_signals: what the photos suggest about the household, used only to cross-check the owner's answers.
- existing_pets: dog / cat / multiple / none / unknown (food bowls, beds, litter trays, pet hair, toys).
- children: yes / no / unknown (children's toys, high chairs, stair gates, children's drawings).
- dwelling_cue: apartment / house / unknown. outdoor_access_cue: yard / balcony / none / unknown.
Use "unknown" unless there is clear evidence. "none" and "no" need clear evidence of absence.

improvements: up to 5 specific changes, most important first.
space_summary: 1 to 2 sentences describing the room. confidence: your overall confidence. notes: uncertainties, and what better photos would show.

HOUSEHOLD FACTORS TO WEIGH
- children_at_home = young: flag things that bring a dog and a small child together unsupervised (toys on the floor at dog height, food at child height, no spot the dog can retreat to, no way to gate off a play or sleep area). Recommend a dog-only retreat and a baby gate where it fits the room. Use category J or M.
- children_at_home = older: mention a dog-only retreat spot only if the room clearly lacks one.
- hours_alone = 4_to_8 or over_8: a bored dog left alone chews, digs and tries to get out, so raise the severity of anything chewable or escapable within reach (cords, bins, shoes, cushions, plants, door gaps, low windows) by one step, and recommend a safe zone or crate area that can be cleared of hazards. If alone_plan is walker or daycare, do this only for over_8. Over 8 hours with alone_plan none: also say in improvements that a dog walker or daycare would help.
- hours_alone = under_4 or not_answered: no change.
- existing_pets.other includes cat: flag cat food, litter trays and other cat areas the dog could reach (toxic_ingestible or clutter), and suggest keeping them out of the dog's reach.
- existing_pets.other includes bird or small_animal: flag cages or hutches at dog height or where the dog could knock them over, and suggest raising them or keeping that room off-limits to the dog.
- existing_pets.other includes fish or reptile: flag tanks the dog could knock or reach, and heat lamp or filter cords, and suggest keeping them stable and out of reach.
- experience = none: keep every recommendation simple and specific.
- household_atmosphere = busy: suggest a retreat spot away from foot traffic.
- allergies = true: suggest keeping the dog off beds and soft furnishings; this is not a hazard.

CHECKLIST: check each item and report what is present.
A. Toxic plants (for example sago palm, oleander, lily of the valley, aloe, pothos)
B. Exposed cords and cables
C. Cleaning products, chemicals, medicines, food within reach
D. Sharp objects, and fragile or valuable items at dog height
E. Hot surfaces and heaters; slippery hard floors (large or older dogs); cold tile for short-coated dogs
F. Stairs, steps and changes in floor level
G. Escape and fall: balcony railings and gaps, openable or unscreened windows, doors to outside, fence gaps
H. Climb and jump: furniture a dog could climb to reach a window, ledge or railing, or jump from and get hurt
I. Clear floor space for this dog's size and energy
J. Areas to keep the dog out of (nursery, home office, kitchen) and how to close them off
K. Outside noise and stressors (busy road, shared walls)
L. Amenities and their risks (pool = drowning; yard = exercise)
M. People and pets in the home and how the dog would fit in
N. Behaviour: chewing, jumping and digging versus what is in this room

VOICE
- Warm, plain English. why_it_matters and recommendation are one sentence each, at most 25 words.
- No ALL CAPS and no alarm words such as "immediately", "urgent", "critical" or "warning".
- Never present this as a substitute for a vet, trainer or other professional.

Return ONLY JSON that matches the response schema.
```

---

## 3. Prompt 2: breed matchmaker ("Explore breeds for my space")

1. **Rules first.** Every catalogue breed (3 hand-checked + The Dog API) is run through
   the same rules (§4) for this room and household, ranked by verdict then blend, and the
   **top 30** become the shortlist.
2. **Then AI.** Gemini gets the prompt below plus JSON with the same `household` object as
   the room prompt, a room summary (`space_summary`, number of physical hazards counted,
   number of tagged items, openness, retreat spot), and the 30 candidates (name, size,
   energy, noise, temperament, group, and `rule_fit` = the five bands + overall verdict).
3. **Checked after.** Picks not on the shortlist are dropped, digits are stripped from the
   text, and fewer than 3 valid picks falls back to the rules list.

When the AI is off or fails, each rules-based suggestion gets a "watch out" line in this
order: over 8 hours alone without a walker or daycare; young children; chasing a cat;
first dog; hazards to move; no outdoor space; otherwise "a quiet corner of its own".

```text
You are PawSpace's dog-breed matchmaker. A person is checking whether their home suits a dog. Recommend dog breeds that would genuinely suit THIS home and household.

You receive JSON with:
- "household": the owner's own answers, treat them as facts ("not_answered" = unknown): dwelling, rental, neighbours (attached / close_separate / not_close), outdoor_access and outdoor_use (most_days / sometimes / rarely), children_at_home (none / young = under 5 / older = 5+), hours_alone (a typical day: under_4 / 4_to_8 / over_8), alone_plan (none / walker / daycare), owner_activity (sedentary / moderate / active), exercise_time (under_30 / 30_60 / over_60 minutes a day), experience (none = first dog / some = has owned a dog before), household_atmosphere (calm / mixed / busy), allergies (true / false), existing_pets (dogs, and other: cat / bird / small_animal / fish / reptile / other), size_preference (small / medium / large / any = the size of dog they would like).
- "room": a summary of the captured room, how many physical hazards were found, how many items the user tagged to protect, and how open the floor is and whether there is a spot for a dog bed.
- "candidates": a shortlist of real breeds. Each has name, size (small <12kg, medium 12-25kg, large >25kg), energy (low/moderate/high), noise (quiet/moderate/vocal), temperament, breed group, 1–5 scores where known (good_with_children, good_with_other_dogs, trainability, shedding; 5 = most, null = unknown), and "rule_fit": how PawSpace's rules rate it for this home (energy, safety, room, household, noise and overall: poor/adequate/good).
- When temperament or group is empty, use the 1–5 scores instead: good_with_children 4–5 counts as gentle and patient with children, good_with_other_dogs 4–5 as sociable with dogs, trainability 4–5 as eager to please (easier for a first dog), and shedding 1–2 as low shedding.

How to choose:
- ONLY choose breeds from "candidates". Copy each name exactly.
- Favour breeds whose rule_fit overall is good, then adequate. Weigh: energy vs owner_activity, exercise_time and outdoor space the dog will actually use (a high energy dog needs an active owner and over an hour a day); floor space vs size and energy; neighbour closeness vs noise (attached walls + vocal is a poor match); rentals favour smaller, quieter dogs; tagged items and hazards favour calmer, less destructive dogs; existing dogs favour sociable breeds.
- Size: if size_preference is small, medium or large, most picks should be that size; include another size only when it is a clearly better fit, and say so in "watch_out". With "any" or not_answered, offer a mix of sizes.
- Experience: for a first dog (experience none), favour easy-going, eager-to-please breeds and avoid stubborn, independent or very high energy ones.
- Home atmosphere: a busy home suits confident, easy-going breeds; avoid shy or sensitive ones.
- Allergies: if allergies is true, favour breeds known to shed little (for example poodles, bichons, schnauzers) when they are in the candidates, and mention grooming in "watch_out".
- A cat, bird or small animal at home (existing_pets.other): avoid breeds with a strong chase or prey drive (many hounds and terriers) and mention slow introductions or keeping them apart in "watch_out".
- Children: with young children, favour breeds whose temperament is gentle, patient or tolerant, and avoid very boisterous or easily-startled ones; mention supervision in "watch_out". Older children suit most friendly, playful breeds.
- Time alone: with 4 to 8 hours alone, favour moderate or low energy breeds that are described as independent or calm. With over 8 hours alone, strongly favour low energy, independent, quieter breeds, avoid high energy or very people-focused breeds, and unless alone_plan is walker or daycare say in "watch_out" that one would help. Long hours alone plus attached walls makes a vocal breed a poor match.
- Offer variety (different sizes and temperaments) when several breeds fit similarly.
- Return up to 8 breeds, best match first.

Tone and rules:
- Plain, warm, non-judgemental English. NEVER use numbers, scores, percentages or rankings in the text.
- "reason": one sentence (max 18 words) on why it suits this specific home.
- "watch_out": one sentence (max 14 words) on the main thing to plan for.
- Do not claim certainty about an individual dog; breed only explains part of behaviour.

Return ONLY JSON in exactly this shape:
{ "suggestions": [ { "name": "Breed Name", "fit": "good" | "could_work" | "tricky", "reason": "…", "watch_out": "…" } ] }
```

---

## 4. The rules (`src/logic/suitability.ts`)

Five internal sub-scores, each a band `poor | adequate | good`. All numbers below are
internal; the user only ever sees words.

### 4.1 Weights and verdict

| Sub-score | Weight | Source |
|---|---|---|
| Safety | 35% | photos |
| Energy & management fit | 25% | breed + questionnaire |
| Room to move | 15% | photos |
| Household fit | 15% | questionnaire + photo cross-check |
| Noise fit | 10% | breed + questionnaire |

Photo-derived weight = Safety + Room = **50%**.

```
blend   = Σ weight × band value        (good 1, adequate 0.5, poor 0)
verdict = good if blend ≥ 0.80, adequate if blend ≥ 0.45, otherwise poor
then:     "good" becomes "adequate" if any hard gate fires (§4.7), anything is unknown
          (§4.8), or any sub-score is poor
```

On screen: good → **"✓ Good fit"**; adequate → **"! Good fit with a few changes"**, or
**"! Could be a good fit"** when the cap came from unknowns; poor → **"✕ Not a good fit
yet"**.

**Why photos get 50% (design note from the PRD).** Research on dog suitability and
relinquishment weights *energy/management fit and expectations* highest. This setup
deliberately weights the **photo-derived signals higher**, because the room scan is
PawSpace's differentiator and users' main signal. To stop that from amplifying mistakes
in what the AI reads from photos, three safeguards are built in:
- every finding has a confidence, and low-confidence findings count at half weight (§4.2);
- the hard gates (§4.7);
- the unknowns rule (§4.8).

Object detection grounding (PRD §7) would be the fourth safeguard, once a detector
exists. Revisit the split after user testing with real rooms.

**Master variable table** (from the PRD, with how each is built):

| Variable | Source | Importance | Extraction reliability | Role in the verdict | Built as |
|---|---|---|---|---|---|
| Escape/fall hazards | photo | High (critical) | Moderate (high with detection) | Hard gate + top of Safety | `hazard_type: escape_fall`, `escape_routes[]` |
| Toxic/ingestible | photo | High | Moderate | High in Safety; gate if hard to fix | `toxic_ingestible`, `easy_fix` |
| Electrical/thermal | photo | Moderate | Moderate | Mid Safety | `electrical_thermal` |
| Floor/stairs (size-scaled) | photo | Moderate | Moderate–high | Mid Safety | `floor_stairs` |
| Fragile/valuable × size | photo + tag | Moderate (home) | Moderate–high | Low–mid Safety (tags excluded) | `fragile_valuable`; tags → `user_tag` |
| Openness / room to move | photo | Low–moderate | Moderate (qualitative) | Room 15% | `room_assessment.openness` |
| Retreat spot | photo | Moderate | Moderate | Room + household | `room_assessment.retreat_spot` |
| Clear path | photo | Low–moderate | Moderate | Room (large dogs) | `room_assessment.clear_path` |
| Clutter / management load | photo | Low–moderate | Moderate | Safety modifier | `clutter` (weight 0.5) |
| Detected signals (pets, children, dwelling, outdoor) | photo | Cross-check | Moderate–high | Nudges; fills an unanswered "has a cat" | `detected_signals` |
| Absolute floor m² | photo | Low | **Low** | About zero; medium+ confidence only | `floor_area_m2` |
| Energy vs activity, exercise, hours alone, outdoor | breed + Q | Very high | — | Spine (25%) | §4.3 |
| Noise vs neighbours | breed + Q | Moderate | — | 10% | §4.6 |
| Children present | Q + photo | High | Moderate (photo) | Household (15%) | §4.5 |
| Other pets | Q + photo | Moderate–high | Moderate (photo) | Household | §4.5 |
| Owner experience / home atmosphere | Q | High | — | Household | §4.5 |

### 4.2 Safety (35%)

```
Safety load = Σ type_weight × severity_weight × size_scale × confidence_factor
```

| type_weight | | severity_weight | | confidence_factor | |
|---|---|---|---|---|---|
| escape_fall | 3 | high | 3 | high | 1.0 |
| toxic_ingestible | 2.5 | medium | 2 | medium | 0.8 |
| electrical_thermal | 2 | low | 1 | low | **0.5** |
| floor_stairs | 1.5 | | | | |
| fragile_valuable | 1 | | | | |
| clutter | 0.5 | | | | |
| other | 0 (not a danger) | | | | |

- **size_scale 1.3:** a large dog (by weight; energy doesn't change this one) on
  fragile/valuable, floor/stairs and escape/fall; a small dog on findings marked
  `small_dog_risk` (squeeze gaps, swallowable objects); otherwise 1.0.
- **Counted:** every photo finding with a type above, whether pinned or whole-room.
  **Not counted:** user tags. Escape routes always count; any not already in `hazards`
  are added.
- **Bands:** load 0 → good; under **15** → adequate; 15 or more → poor.
  - Three low cords = 6 → adequate.
  - A low cord, a medium plant and a medium balcony door = 12 (13.8 for a large dog) →
    adequate.
  - Two high escape routes = 18 → poor.
- Results saved before 15 Oct have no `hazard_type`/`confidence`: the type comes from
  the checklist letter, and confidence counts as low.

### 4.3 Energy & management fit (25%, the spine)

```
provision = owner_activity + exercise_time + outdoor − max(0, alone − relief)
```

| Input | Values |
|---|---|
| owner_activity | sedentary 0 · moderate 1 · active 2 |
| exercise_time | under 30 min 0 · 30–60 min 1 · over an hour 2 |
| outdoor | **high-energy dogs only** (spec §4.9): outdoor base (none 0 · balcony 0 · shared yard 0.5 · private yard 1 · pool 1) × use (most days 1 · sometimes 0.5 · rarely 0); 0 for low and moderate energy |
| alone | under 4 h 0 · 4–8 h 0.5 · over 8 h 1.5 |
| relief | walker or daycare 1 · none 0 |

| Dog energy | good if provision ≥ | adequate if ≥ | else |
|---|---|---|---|
| low | 1 | −0.5 | poor |
| moderate | 2 | 1 | poor |
| high | 4 | 2.5 | poor |

**§4.9:** a moderate-energy dog such as the Labrador isn't marked down for having no
outdoor space; only a high-energy dog is. (The original fix, `2e3a106` on the
`AR-implementation` branch, changed the old Space band; v2 applies the same rule here.)

**Unanswered questions:** provision is worked out twice, with every unanswered question
at its worst and at its best value. If both give the same band, that band stands. If
not, the band is "adequate" and marked **unknown** (the routine row says "Not enough
info" and asks the user to answer).

### 4.4 Room to move (15%)

| openness | small/medium dog | large dog (or medium + high energy) |
|---|---|---|
| open | good | good |
| moderate | good | adequate |
| cramped | adequate | poor |

- **Retreat spot:** `retreat_spot: absent` lowers the band one step.
- **Clear path:** `clear_path: poor` (the dog would have to squeeze past furniture)
  lowers the band one step for a large (or medium high-energy) dog, unless the room is
  already rated cramped, so the same problem isn't counted twice. `partial` changes nothing.
- **Floor area:** `floor_area_m2` under 10 m² lowers the band one step for a large (or
  medium high-energy) dog, but **only with medium or high confidence** (photo
  measurements are unreliable).
- **No room assessment** (sample assessment, or results saved before 15 Oct) →
  adequate and marked **unknown**.

### 4.5 Household fit (15%)

| Concern | When | Strength |
|---|---|---|
| Boisterous dog around little ones | young children + (large or high energy) + not gentle (temperament not gentle/patient/tolerant, and good-with-children score not 4–5); or a good-with-children score of 1–2 | mild; **strong** if the room also has no retreat spot |
| No retreat from little ones | young children + `retreat_spot: absent` | mild |
| May chase your other pets | a cat, bird or small animal at home (from the answer; if unanswered, a cat seen in the photos counts) + hound/terrier group or prey/chase temperament. Fish and reptiles don't count (they live in tanks). The line names the pets ("I might want to chase your cat and bird…"). | mild |
| Other dogs | existing dogs + aggressive/dominant/territorial temperament, or a good-with-other-dogs score of 1–2 | mild |
| First dog | no experience + high energy; or + stubborn/independent temperament or a trainability score of 1–2 | mild each |
| Busy home | busy + shy/sensitive/timid temperament | mild |
| Not the size you wanted | `size_preference` is small, medium or large and the breed is a different size ("I'm bigger/smaller than the size of dog you said you'd like."). "Any size" or unanswered never counts. | mild |

No concerns → good; one mild → adequate; two or more, or a strong one → poor.
**Size wanted** (onboarding step "The dog you'd like", 28 Oct 2026) is a preference, not
a safety rule: it only nudges Household fit, so on Explore breeds the rules rank breeds of
the wanted size first, and the breed prompt tells the AI to keep most picks that size.
**Where the breed facts come from:** API Ninjas (preferred, `EXPO_PUBLIC_NINJA_API_KEY`)
has no temperament text but real 1–5 scores (good with children, good with other dogs,
trainability, shedding), so those scores stand in for the temperament words. The Dog API
(the fallback) has temperament text but no scores. With neither, only the size and
energy checks apply. Owners can also change the dog's **size** (as well as energy) on
Select breed to match their own dog; the rules use their value.

### 4.6 Noise fit (10%, unchanged from v1)

| Breed noise ↓ / Neighbours → | attached walls | close, separate building | not close |
|---|---|---|---|
| quiet | good | good | good |
| moderate | adequate | good | good |
| vocal | poor | adequate | good |

### 4.7 Hard gates (cap a "good" verdict at "adequate")

- **Escape:** any high-severity escape/fall finding or escape route.
- **Toxic:** a toxic plant (A) or chemical/medicine (C) the model marked `easy_fix: false`.
- **Energy:** high-energy dog + over 8 h alone + no outdoor space (or rarely used) +
  sedentary owner.

The verdict line then names the first gate ("It can work, but first: make the escape or
fall risk safe."), and the Safety line mentions it too.

### 4.8 Unknowns: never reported as good

| Unknown | When | Effect |
|---|---|---|
| photos | the result is the sample assessment (`resultSource: "mock"`) | Its findings are ignored; Safety is adequate with the chip "Not checked" |
| room | a photo result with no `room_assessment` (saved before 15 Oct) | Room is adequate with the chip "Not checked" |
| routine | §4.3 can't decide without unanswered questions | Energy is adequate with the chip "Not enough info" |

Any unknown blocks "Good fit". The verdict reads "Could be a good fit" plus what to do
("To be sure, capture the room again… and answer the routine questions in your profile.").

### 4.9 Cross-check: photos vs answers

`detected_signals` never change an answer. They produce gentle nudges with an "Update
profile" link: a cat, a dog, pets or children seen; a dwelling or outdoor space that
differs from the profile; and a reminder when routine questions are unanswered. One
exception: when "Do you have any other pets?" is unanswered, a cat seen in the photos
counts for the household check.

### 4.10 What the user sees (`evaluate.ts` + `AnalysisScreen.tsx`)

- **Verdict card:** title (§4.1) and one sentence (§4.7/§4.8).
- **What to change:**
  1. A plan for exercise and company when the energy gate fires.
  2. Up to 3 of the model's `improvements`.
  3. For results without these, the fixes of the highest-scoring hazards.
- **Suggested setup** card, in three groups: "Keep the dog out" (red), "Good spots for
  the dog" (green), "Safety to add" (dark). Items with a position have a "Show on map"
  link that opens the 2D map on that photo and highlights the pin. Suggestions never
  change the verdict. The sample assessment (AI off) gives a few general suggestions
  from the answers only (a quiet bed spot; a gate with young children; a playpen for
  4+ hours alone; balcony netting), without positions.
- **Five rows** in weight order:
  - Safety: Safe / Mostly safe / Move N things / Not safe yet / Not checked.
  - Exercise & routine: Well matched / Needs a plan / Hard to keep up / Not enough info.
  - Room to move: Plenty of room / Enough room / Too tight / Not checked, with chips
    for openness, retreat spot and clear path ("Clear path / Some squeezing past / Hard
    to get through").
  - Your household: Suits your home / Some care needed / Tricky fit.
  - Neighbours: No problem / Some barking / Likely issue.
- **Nudges** box with "Update profile".
- **Map:** labelled pins at each Suggested setup spot ("Keep out", "Dog bed", "Gate",
  "Railing"…), coloured by group; tap one for what and why.
- **Risk cards:** user tags say "Be careful"; real hazards keep their severity word.
- **Removed:** the old "Not ready for this dog yet" box (it came from the retired
  floor-space rule).

### 4.11 Re-run

Re-run runs the room prompt again with the latest household answers and tags, then opens
the updated report straight away.

**What's new since your last run** (`src/logic/changes.ts`, pure and checked by
`npm run check:logic`):
- After every analysis the app saves a snapshot on the space of what the user saw:
  the verdict, the five row labels, each flagged item with its card chip, and the
  Suggested setup.
- On Re-run, the new snapshot is compared with the saved one, so edited questionnaire
  answers and tags show up as changes, not just new AI findings. The result is saved on
  the space (`lastChanges`) until the next run; a first run or a new breed clears it.
- The section sits under the verdict card. It's open in the report shown straight after
  a Re-run and collapsed when the report is reopened later. It lists the verdict change,
  row changes ("Safety: Move 2 things → Not safe yet"), then groups: Newly flagged (+),
  No longer flagged (−), Changed (same item, new chip), New suggestions, Suggestions
  removed. If nothing changed it says so and suggests what to change.
- Items are matched by `object_key` (tags by their name), so a reworded title isn't
  reported as removed + added.

### 4.12 Worked examples (computed with the real code)

Same apartment room (attached walls, balcony used sometimes, 4–8 h alone with no
walker, moderately active owner, 30–60 min a day, no children). The model found: a TV
cord (low, high confidence), a pothos on a low shelf (medium, medium confidence) and an
open balcony door (medium, high confidence). Openness moderate, retreat possible.

| Dog | Safety load | Bands (safety · energy · room · household · noise) | Blend | Verdict |
|---|---|---|---|---|
| Labrador (large, moderate, quiet) | 13.8 | adequate · adequate · adequate · good · good | 0.625 | Good fit with a few changes |
| French Bulldog (small, low, moderate) | 12.0 | adequate · good · good · good · adequate | 0.775 | Good fit with a few changes |
| Border Collie (medium, high, vocal) | 12.0 | adequate · **poor** · adequate · good · **poor** | 0.400 | Not a good fit yet |
| Labrador, balcony door **high** severity, under 4 h alone | 17.7 | **poor** · good · adequate · good · good | 0.575 | Escape gate fires; "It can work, but first: make the escape or fall risk safe." |

### 4.13 Recommendations: Improve and Shopping (`src/logic/recommend.ts`)

From `ar-immersive-scan` (`51d2e26`), rebuilt on v2. A **Recommendations** tab (with a
count) sits top-left on the analysis map and opens a panel with two lists. Neither
changes the verdict.
- **Improve:** one card per pinned finding (dangers and the owner's valuables), each
  off-limits suggestion from the AI, plus cards from the rules: more open floor (Room
  not good), a spot of their own (no retreat spot), daily activity (Energy not good) and
  softer sound near shared walls (Neighbours poor). Room and routine cards only appear
  when those were actually checked. Sorted Priority → Worth doing → Nice to have.
- **Shopping:** one generic product per need, e.g. cable covers for cords, a stair or
  pet gate, a balcony net, a lockable box for chemicals, a dog bed, plus a product for
  each Suggested setup addition (gate, railing, netting, window guard, playpen, cord
  cover, non-slip mat). Each product appears once. Gates and other "close it off" items
  come first and have a **Fence off** button.

### 4.14 Off-limits areas (owner-marked)

From `ar-immersive-scan` (`51d2e26`). The owner can mark an area the dog won't be
allowed into:
- **When tagging:** a third option, **Off-limits**, beside Valuable and Fragile (red ✕
  pin);
- **On the map:** from "Mark this area off-limits" / "Fence off" in Recommendations. A
  tinted tap-to-place mode on the photo drops a red "✕ label" marker; tapping a marker
  asks before removing it.

Off-limits areas are **not** things to protect, so they never become "protect this"
entries and never count towards Safety. The room prompt receives them as
`off_limit_areas`: it won't suggest them again, and it adds a gate where it can't see
a way to close one off. Older areas marked in the (removed) 3D view have no photo
(`frame -1`); they're still sent to the AI but can't be shown on the photo map.

---

## 5. Known weaknesses

| # | Issue | Status |
|---|---|---|
| W1 | No measured room size | **Partly fixed.** The constant is gone; Room uses the model's qualitative openness, retreat spot and clear path, and m² only at medium+ confidence. True measurement needs AR/LiDAR or detection (§1.1, §8). |
| W2 | Model asked for a score/verdict nobody used | **Fixed.** Removed from the prompt and schema; the rules own the verdict. |
| W3 | Unasked defaults sent as facts | Fixed 14 Oct. |
| W4 | Cat content in a dogs-only prompt | **Fixed.** Dogs only; H recast as "climb & jump". |
| W5 | Tags treated as dangers and double-counted | **Fixed.** `user_tag`, risk to home, pinned at the tag, excluded from Safety. |
| W6 | No severity rubric | **Fixed** in the prompt. |
| W7 | Count ignored severity; escapes could be unpinned | **Fixed.** Weighted load; escapes forced to pinned objects. |
| W8/W9 | Photo order; duplicates | **Fixed.** "No guaranteed order", one entry per `object_key`, merged in the normaliser. |
| W10 | Breed traits not used | **Fixed.** `dog` size/energy/noise sent as ground truth. |
| W11 | No schema enforcement | **Fixed.** `responseSchema` + allowed-value checks in the normaliser. |
| W12 | Alarming tone | **Fixed** in the prompt (VOICE section). |
| W13 | Titles change between runs | **Fixed.** `object_key` gives each object a stable identity (used to merge duplicates). |

Open issues to look at next:

- **N1. Thresholds are not calibrated on real rooms.** VERDICT_GOOD_AT 0.8,
  VERDICT_ADEQUATE_AT 0.45, SAFETY_POOR_LOAD 15, the energy needs table and SMALL_ROOM_M2
  10 are first estimates. They live as named constants at the top of `suitability.ts`.
  Tune them with real captures, then update the checks.
- **N2. Severity and confidence are the model's judgement.** The escape gate depends on
  the model calling something "high". Object detection (§1.1) would anchor this.
- **N3. Household fit leans on temperament keywords** from The Dog API; breeds without
  temperament text get only the size and energy checks.
- **N4. Allergies affect only the breed prompt** (no shedding data in the catalogue).
- **N5. The breed prompt has no `responseSchema` yet**; it relies on the shortlist check.
- **N6. The room `responseSchema` hasn't been accepted by the live API yet** (503s on
  15 Oct). If the API rejects it, the app retries without it (§2.2), so real AI keeps
  working.

---

## 6. Constraints for any new prompt

- **Dogs only.** No score, rating, percentage or verdict from the model.
- **Allowed values must match `schema.ts`.** Changing an enum means changing `schema.ts`,
  `types.ts` and (if it affects scoring) `suitability.ts`, then running
  `npm run check:logic`.
- **Pins** are 0–1 of the original, uncropped photo, with `frame_index` 0-based and below
  the number of photos.
- **Keep the schema small and flat.** The Gemini API rejects very large or deeply nested
  schemas. Free tier, up to 10 images, 30-second timeout, 3 attempts.
- **No breed stereotyping**, no claims about an individual dog, and never present the
  result as a vet's or professional's advice.

## 7. Suggested brief for Opus

> Here is PawSpace's room prompt (§2.4), its output contract (§2.2), the rules that use it
> (§4) and the open issues (§5). Improve the prompt's accuracy for a dogs-only app. In
> particular: make severity and confidence more consistent between runs (N2), and make
> `room_assessment.openness` and `retreat_spot` reliable for this dog's size. Keep every
> field and allowed value in `schema.ts`, keep `object_key` stable, keep the HOUSEHOLD
> FACTORS guidance, and never output a number or verdict. Return the new prompt and any
> schema changes, and list which acceptance checks in `scripts/check-logic.mjs` to update.

## 8. AR and object detection

From user testing, October 2026:
- **AR would help with measuring the house area.** That's W1.
- **AR wouldn't add much to hazard detection.** The photo/video method already does it;
  testers suggested upgrading that instead of adding AR.
- **An animated dog wouldn't excite them.** They care about hazards and what to change.

Logic v2 follows this by getting more out of the photos (room quality, escape routes,
suggested setup, household signals). The next step is object detection (§1.1) to ground
those findings. **AR has since been removed:** `main` has no AR code or packages. The
prototypes remain only on the `feat/native-ar-foundation` and `ar-immersive-scan` branches.

---

## 9. PRD v2 acceptance criteria: status

| Criterion (PRD §9) | Status | How it's checked |
|---|---|---|
| Valid JSON every run via `responseSchema`; no cat content; no numeric score | **Built.** Schema sent with every room call (retry without it on HTTP 400). Dogs-only prompt; no score or verdict in the prompt or schema. | `check:logic` "Prompt and schema" checks; fake-API check for the 400 retry. **Not yet confirmed against the live API** (N6). |
| Same object across frames counted once | **Built** (merge by `object_key` in the normaliser). | "dedup" check |
| Tagged vase → `user_tag`, excluded from Safety, pinned at the tag's x,y | **Built.** | "tagged vase" check |
| One high escape/fall caps the verdict; three low cords don't force "poor" | **Built.** | "hard gates" and "three low-severity cords" checks |
| Changing `owner_activity` or `hours_alone` changes the verdict | **Built.** | Two regression checks |
| Every finding has `object_key`, `confidence`, and a location if `scope: object` | **Built** (the normaliser fills any that are missing). | "every finding carries" check |
| Pre-flight result recorded | **Done**: no object detection, so the LLM-only path, plus a recommendation (§1.1). | §1.1 and the v2 commit message |
| Photo-derived ≈ 50%; low confidence at half weight | **Built.** | "Weights" and "half weight" checks |

`npm run check:logic` currently runs **54 checks**, all passing.

---

## 10. Where the build differs from the PRD (and why)

**Not built or done differently:**
- **Object detection (PRD §7): not built.** No detector exists (§1.1).
- **Chip words.** The PRD keeps the v1 words ("Spacious / Snug / Cramped", "Safe / Mostly
  safe / Hazardous", "Good / Adequate / Poor"). The build uses plainer words with ✓ / ! / ✕
  marks, because user testing found the v1 words unclear (§4.10).
- **Off-limit areas** are labelled pins on the map with a reason, not drawn regions; the
  model gives a point, not an outline.
- **"What to change"** uses the model's improvements. Off-limit areas are listed under
  Suggested setup instead, so nothing appears twice.
- **Thresholds.** The PRD says "calibrate on test rooms". The build uses first estimates
  (Safety poor at a load of 15; verdict good at 0.80, adequate at 0.45), tuned on worked
  examples (§4.12, N1).

**Added beyond the PRD:**
- **Unknowns cap (§4.8):** anything the app couldn't check stops a "Good fit".
- **Poor sub-score cap:** any "poor" sub-score also stops a "Good fit".
- **Suggested setup:** dog spots and safety additions, alongside the off-limit areas.
- **"What's new since your last run"** after a Re-run (§4.11).
- **Recommendations / Shopping** and **owner-marked off-limits areas** (§4.13, §4.14).
- **Retry without the schema** if the API rejects it.

---

## 11. Out of scope (from the PRD)

True 3D / LiDAR reconstruction, absolute-measurement (m²) gating, AR capture, cats and
other species, and training a new detection model from scratch.
