# PawSpace: how suitability is decided (prompt + rules)

A hand-off for refining PawSpace's AI prompts and rules. It explains, end to end, how
the app goes from room photos + questionnaire to "is this space suitable for this dog?",
what the model is asked, what the app does with the answer, and what is still weak.
Current version: **logic v2** (CHANGE PRD 15 Oct 2026), branch `feat/native-ar-foundation`.

**Changelog**
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

## 0. Where the logic lives

| What | File |
|---|---|
| Suitability rules: weights, formulas, gates, unknowns, cross-check | `src/logic/suitability.ts` (pure logic, no app code) |
| Words the user sees: verdict, chips, lines, "What to change", nudges | `src/logic/evaluate.ts` |
| Room prompt text | `src/ai/prompt.ts` |
| Output contract: allowed values + Gemini `responseSchema` | `src/ai/schema.ts` |
| Building and sending the request | `src/ai/gemini.ts` (retries + fallback in `src/ai/assess.ts`) |
| Checking and cleaning the model's reply | `src/ai/normalise.ts` |
| Sample assessment (AI off or failed) | `src/ai/mock.ts` |
| Breed suggestions (rules shortlist + breed prompt) | `src/ai/breedSuggest.ts` |
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

### 1.1 Pre-flight results (PRD §1)

- **Object detection: not present on this branch.** No YOLO/TFLite/ONNX/Core ML/ML Kit
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
       "existing_pets": { "dogs": [], "has_cat": false }
     },
     "tags": [ { "id": "tag_1", "label": "Vase", "note": "Fragile", "frame": 0, "x": 0.3, "y": 0.6 } ]
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
| `off_limit_suggestions[]` | zone (kitchen/balcony/nursery/office/stairs/other), reason, frame | "What to change", map callouts |
| `detected_signals` | existing_pets, children, dwelling_cue, outdoor_access_cue | Profile nudges; fills an unanswered "has a cat" |
| `improvements[]` | up to 5 strings | "What to change" |
| `space_summary`, `confidence`, `notes` | text | 3D view summary, breed prompt |

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
  confidence (W7).
- **Merges duplicates**: one entry per `object_key`, keeping the stronger report (W8/W9).
- **Tags** (W5): every tag appears exactly once, as `source: "user_tag"`,
  `risk_to: "home"`, pinned at the tag's own x, y. A tag the model left out is added. A
  photo finding that is really the tagged item (same key, or a fragile/valuable finding
  within 0.12 of the tag on the same photo) is folded into it.
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
   - experience: none / some / experienced (has owned dogs before).
   - household_atmosphere: calm / mixed / busy.
   - allergies: true / false (someone at home is allergic to pets).
   - existing_pets: dogs (breeds already in the home) and has_cat (true / false).
4. TAGS ("tags"): objects the owner marked themselves, each with id, label, note ("Valuable" or "Fragile"), frame, x and y. They are things to PROTECT FROM the dog, not dangers to the dog.

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
- scope: "object" for anything you can point to in a photo; "space" only for whole-room findings. Escape and fall findings are ALWAYS "object" with a location.
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

off_limit_suggestions: areas visible in the photos that this dog should be kept out of (kitchen, balcony, nursery, office, stairs, other), each with a one-sentence reason and the photo where it shows.

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
- existing_pets.has_cat = true: flag cat food, litter trays and other cat areas the dog could reach (toxic_ingestible or clutter), and suggest keeping them out of the dog's reach.
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
- "household": the owner's own answers, treat them as facts ("not_answered" = unknown): dwelling, rental, neighbours (attached / close_separate / not_close), outdoor_access and outdoor_use (most_days / sometimes / rarely), children_at_home (none / young = under 5 / older = 5+), hours_alone (a typical day: under_4 / 4_to_8 / over_8), alone_plan (none / walker / daycare), owner_activity (sedentary / moderate / active), exercise_time (under_30 / 30_60 / over_60 minutes a day), experience (none / some / experienced), household_atmosphere (calm / mixed / busy), allergies (true / false), existing_pets (dogs, has_cat).
- "room": a summary of the captured room, how many physical hazards were found, how many items the user tagged to protect, and how open the floor is and whether there is a spot for a dog bed.
- "candidates": a shortlist of real breeds. Each has name, size (small <12kg, medium 12-25kg, large >25kg), energy (low/moderate/high), noise (quiet/moderate/vocal), temperament, breed group, and "rule_fit": how PawSpace's rules rate it for this home (energy, safety, room, household, noise and overall: poor/adequate/good).

How to choose:
- ONLY choose breeds from "candidates". Copy each name exactly.
- Favour breeds whose rule_fit overall is good, then adequate. Weigh: energy vs owner_activity, exercise_time and outdoor space the dog will actually use (a high energy dog needs an active owner and over an hour a day); floor space vs size and energy; neighbour closeness vs noise (attached walls + vocal is a poor match); rentals favour smaller, quieter dogs; tagged items and hazards favour calmer, less destructive dogs; existing dogs favour sociable breeds.
- Experience: for a first dog (experience none), favour easy-going, eager-to-please breeds and avoid stubborn, independent or very high energy ones.
- Home atmosphere: a busy home suits confident, easy-going breeds; avoid shy or sensitive ones.
- Allergies: if allergies is true, favour breeds known to shed little (for example poodles, bichons, schnauzers) when they are in the candidates, and mention grooming in "watch_out".
- A cat at home (has_cat true): avoid breeds with a strong chase or prey drive (many hounds and terriers) and mention slow introductions in "watch_out".
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
| outdoor | outdoor base (none 0 · balcony 0 · shared yard 0.5 · private yard 1 · pool 1) × use (most days 1 · sometimes 0.5 · rarely 0) |
| alone | under 4 h 0 · 4–8 h 0.5 · over 8 h 1.5 |
| relief | walker or daycare 1 · none 0 |

| Dog energy | good if provision ≥ | adequate if ≥ | else |
|---|---|---|---|
| low | 1 | −0.5 | poor |
| moderate | 2.5 | 1 | poor |
| high | 4 | 2.5 | poor |

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
- **Floor area:** `floor_area_m2` under 10 m² lowers the band one step for a large (or
  medium high-energy) dog, but **only with medium or high confidence** (photo
  measurements are unreliable).
- **No room assessment** (sample assessment, or results saved before 15 Oct) →
  adequate and marked **unknown**.

### 4.5 Household fit (15%)

| Concern | When | Strength |
|---|---|---|
| Boisterous dog around little ones | young children + (large or high energy) + temperament not gentle/patient/tolerant | mild; **strong** if the room also has no retreat spot |
| No retreat from little ones | young children + `retreat_spot: absent` | mild |
| May chase the cat | has a cat (answer, or seen in photos if unanswered) + hound/terrier group or prey/chase temperament | mild |
| Other dogs | existing dogs + aggressive/dominant/territorial temperament | mild |
| First dog | no experience + high energy; or + stubborn/independent temperament | mild each |
| Busy home | busy + shy/sensitive/timid temperament | mild |

No concerns → good; one mild → adequate; two or more, or a strong one → poor.
Temperament text comes from The Dog API; the 3 built-in breeds have it only once the API
catalogue loads, so for them only the size and energy checks apply.

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
exception: when "Do you have a cat?" is unanswered, a cat seen in the photos counts for
the household check.

### 4.10 What the user sees (`evaluate.ts` + `AnalysisScreen.tsx`)

- **Verdict card:** title (§4.1) and one sentence (§4.7/§4.8).
- **What to change:**
  1. A plan for exercise and company when the energy gate fires.
  2. Up to 3 of the model's `improvements`.
  3. Up to 2 off-limit suggestions ("Keep the dog out of the kitchen: …").
  4. For results without these, the fixes of the highest-scoring hazards.
- **Five rows** in weight order:
  - Safety: Safe / Mostly safe / Move N things / Not safe yet / Not checked.
  - Exercise & routine: Well matched / Needs a plan / Hard to keep up / Not enough info.
  - Room to move: Plenty of room / Enough room / Too tight / Not checked, with chips
    for openness and retreat spot.
  - Your household: Suits your home / Some care needed / Tricky fit.
  - Neighbours: No problem / Some barking / Likely issue.
- **Nudges** box with "Update profile".
- **Map:** "Off-limits: Kitchen" style callouts on the photo they belong to; tap one for
  the reason.
- **Risk cards:** user tags say "Be careful"; real hazards keep their severity word.
- **Removed:** the old "Not ready for this dog yet" box (it came from the retired
  floor-space rule).

### 4.11 Re-run

Re-run compares the verdict and the flagged items before and after. Items are matched by
`object_key` (W13), so the same object with a reworded title is no longer reported as
"removed + added". Results saved before 15 Oct fall back to matching by title.

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
| Labrador, balcony door **high** severity | 17.7 | **poor** · adequate · adequate · good · good | 0.450 | Escape gate fires; "It can work, but first: make the escape or fall risk safe." |

---

## 5. Known weaknesses

| # | Issue | Status |
|---|---|---|
| W1 | No measured room size | **Partly fixed.** The constant is gone; Room uses the model's qualitative openness and retreat spot, and m² only at medium+ confidence. True measurement needs AR/LiDAR or detection (§1.1, §8). |
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
| W13 | Titles change between runs | **Fixed.** `object_key` for matching. |

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
off-limit areas, household signals). The next step is object detection (§1.1) to ground
those findings. The AR placement prototype on this branch is unchanged.
