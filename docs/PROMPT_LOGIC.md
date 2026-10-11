# PawSpace: how suitability is decided (prompt + rules)

A hand-off for refining PawSpace's AI prompts. It explains, end to end, how the app
goes from room photos + questionnaire to "is this space suitable for this dog?", what
the model is asked, what the app does with the answer, and where the current setup is
weak. Written against branch `feat/native-ar-foundation` (October 2026).

---

## 1. The big picture

The final "suitable or not" answer is **not** decided by the AI. It's decided by fixed
rules in the app (`src/logic/evaluate.ts`, spec §4). The AI's job is to **look at the
photos and list hazards**; the rules then turn those hazards, the questionnaire and the
breed's traits into the verdict the user sees.

```
 Photos (≤10) ─┐
 Questionnaire ├─► [1] ROOM PROMPT (Gemini) ─► hazards JSON ─┐
 Breed + tags ─┘                                              │
                                                              ▼
 Breed traits (size/energy/noise) ──────────────────► [2] RULES (evaluate.ts)
 Room size (a FIXED estimate, see §4.2) ────────────►    Space / Safety / Noise bands
 Tag count ─────────────────────────────────────────►    → verdict, dog mood, report text
                                                              │
 "Explore breeds" only:                                       ▼
 all catalogue breeds ─► RULES rank them ─► top 30 ─► [3] BREED PROMPT (Gemini) ─► up to 8 picks
```

There are **two prompts**:

| # | Prompt | File | When it runs | Model settings |
|---|---|---|---|---|
| 1 | Room assessment (`SYSTEM_PROMPT`) | `src/ai/prompt.ts`, sent by `src/ai/gemini.ts` | After a breed is chosen, and on Re-run | `gemini-3.6-flash`, temperature 0.4, `responseMimeType: application/json`, no response schema |
| 2 | Breed matchmaker (`BREED_SUGGEST_PROMPT`) | `src/ai/breedSuggest.ts` | "Explore breeds for my space" on Select breed | same model, temperature 0.5 |

When real AI is off, the key is missing, the photos aren't in memory (after an app
restart), or all 3 attempts fail, a **built-in mock** (`src/ai/mock.ts`) produces the
hazards instead, and breed suggestions come from the rules alone. A "sample assessment"
note tells the user.

---

## 2. Prompt 1: room assessment

### 2.1 What gets sent

One request, all in a single `user` turn, in this order (`gemini.ts → callGemini`):

1. **The system prompt** (full text in §2.3).
2. **`CONTEXT:` + a JSON string**:
   ```json
   {
     "mode": "pet_in_mind",
     "pet": { "species": "Dog", "breed": "Labrador Retriever", "size": "large", "energy": "moderate", "noise": "quiet", "imageUrl": "…" },
     "questionnaire": {
       "dwelling": "apartment", "rental": true, "neighbours": "attached",
       "floor_level": null, "outdoor_access": "balcony",
       "adults": 1, "children": 0, "children_ages": "", "infant_present": false,
       "existing_pets": [], "off_limit_zones": [],
       "activity_level": "medium", "wants_apartment_friendly": true
     },
     "tags": [ { "label": "Vase", "note": "Fragile", "frame": 0 } ]
   }
   ```
3. **Up to 10 photos** as inline base64 JPEGs, about 1024px wide, in capture order.

Only `dwelling`, `rental`, `neighbours`, `outdoor_access` and `existing_pets` are asked in
the current questionnaire. Every other questionnaire field is a **default value the user
never set** (see weakness W3).

### 2.2 What the app does with the reply

`normalise.ts` cleans the JSON defensively: it guarantees the arrays exist, defaults an
unknown category to `I`, an unknown severity to `medium` and an unknown verdict to
`suitable_with_changes`, clamps coordinates to 0–1, and puts a missing pin at the centre
of frame 0. Then:

| Field the model returns | Used by the app? |
|---|---|
| `hazards[]` (category, scope, location, severity, title, why_it_matters, recommendation) | **Yes, the main output.** Pins on the 2D map, the "Potential Risks!" cards, and the hazard count that drives the Safety band |
| `space_summary` | Yes: fed into the breed prompt, and shown in the 3D view |
| `suitability.verdict`, `suitability.score_0_100` | **Not shown in the main report.** Only passed to the 3D view's data, and its banner is hidden because it could show a score |
| `improvements[]`, `confidence`, `notes`, `recommended_pets` | **Not shown anywhere** |

So in practice the room prompt is a **hazard detector and locator**. Everything it's
asked to judge about overall suitability is thrown away.

### 2.3 The system prompt, verbatim

```text
You are a companion-animal home-safety and suitability assessor. You analyse photos of ONE room together with structured household context and either (a) a specific pet, or (b) a request to recommend suitable pets. You return a structured assessment of hazards to the animal, hazards to the home/occupants caused by the animal, and concrete, practical improvements.

INPUTS YOU RECEIVE
1. PHOTOS: several overlapping stills captured by sweeping a phone across one room, ordered left-to-right and 0-indexed. Treat them as partial views of the same space. For every object-level finding, note WHICH photo index it appears in and WHERE in that photo it sits, so it can be pinned onto a 2D room map. Reason only about what is visibly present or strongly implied. NEVER invent objects you cannot see. If something is ambiguous, lower your confidence rather than guessing.
2. MODE: "pet_in_mind" (a species/breed is given) or "explore" (recommend pets for this space).
3. PET (pet_in_mind only): species + breed. Consider that breed's typical adult size, energy/activity level, exercise needs, jumping/climbing ability, chewing tendency, escape behaviour, and temperature sensitivity — but assess THIS space and context. Do NOT reject or penalise a breed on stereotype alone; every judgement must be grounded in the actual space + context.
4. HOUSEHOLD CONTEXT (questionnaire): dwelling type, rental status, floor level, outdoor access (balcony/yard/pool/none), number/ages of occupants, infants present, existing pets, off-limit/sensitive zones, household activity level, whether an apartment-friendly pet is wanted.
5. USER-TAGGED OBJECTS: objects the user manually flagged, each with a label + note (e.g., "antique vase — valuable & fragile"). Treat these as HIGH-PRIORITY, authoritative context and always address them.

ASSESSMENT CHECKLIST — systematically check each of these and report those present, relevant, or notably missing when they should be present:
A. Toxic/harmful plants (e.g., lilies for cats, sago palm)
B. Exposed electrical cords / cables (chewing, entanglement)
C. Accessible cleaning products, chemicals, medications
D. Sharp objects and fragile/valuable items at pet height (glass, vases)
E. Thermal & surface hazards (hot surfaces; slippery hard floors for large/senior dogs; cold tile for short-coated/hairless breeds)
F. Floor levels & stairs (mobility risk for small, senior, or heavy breeds)
G. Escape & fall risks — gaps, balcony railing spacing, unscreened/openable windows (CRITICAL for cats: high-rise fall risk), fencing gaps, doors to outside
H. Vertical space & climbable height (cats need vertical territory — is any provided?)
I. Floor space vs the animal's adult size and activity level; apartment-suitability
J. Off-limit / sensitive zones (nursery, baby crib, home office) and how to separate them
K. Outside noise / stressors (busy road, shared walls) visible or implied
L. Amenities & their risks (pool = drowning risk; yard = enrichment)
M. Number of occupants (humans + existing pets) and likely compatibility / territory needs
N. Behavioural fit — chewing, jumping, digging tendencies of the breed vs what is in the room

LOCALISATION — every finding must be pinnable or explicitly space-level:
- Classify each finding's scope as "object" (tied to a specific thing/place visible in a photo) or "space" (about the room as a whole — e.g. overall size, vertical space, floor level, household compatibility).
- For each "object" finding, return its location: the photo index, an approximate point as normalised x and y in [0,1] (0,0 = top-left of that photo), and an optional bounding box [x, y, w, h] in the same normalised space.
- For each "space" finding, set scope to "space" and location to null.
- Localisation is approximate — do your best, and do not invent precision you do not have.

OUTPUT — return ONLY valid JSON matching this schema. No prose outside the JSON.
{
  "mode": "pet_in_mind" | "explore",
  "space_summary": "1-2 sentences describing the room as seen",
  "confidence": "low" | "medium" | "high",
  "hazards": [
    {
      "id": "string",
      "category": "A"|"B"|"C"|"D"|"E"|"F"|"G"|"H"|"I"|"J"|"K"|"L"|"M"|"N",
      "title": "short label",
      "scope": "object" | "space",
      "location": { "frame_index": 0, "x": 0.0, "y": 0.0, "bbox": [0.0, 0.0, 0.0, 0.0] },
      "risk_to": "animal" | "home" | "both",
      "severity": "low" | "medium" | "high",
      "evidence": "what in the photos/context triggered this",
      "why_it_matters": "tie to the specific pet + context",
      "recommendation": "one concrete fix"
    }
  ],
  "improvements": ["prioritised, actionable strings"],
  "suitability": {
    "verdict": "well_suited" | "suitable_with_changes" | "poorly_suited",
    "score_0_100": 0,
    "rationale": "string"
  },
  "recommended_pets": [
    { "species": "string", "breed": "string", "why": "string", "caveats": "string" }
  ],
  "notes": "uncertainties; what a fuller/3D scan would clarify"
}

RULES
- In pet_in_mind mode, fill "suitability" and set "recommended_pets" to []. In explore mode, set "suitability" to null and return 2-3 items in "recommended_pets".
- Be specific: "move the pothos off the low shelf by the window", not "remove toxic plants".
- Prioritise user-tagged objects, infants, and off-limit zones.
- Give every "object" hazard a location (frame_index + x,y in [0,1], optional bbox) so it can be pinned to the map; give every "space" hazard location: null.
- Never present the assessment as definitive or a substitute for a vet/shelter/professional. Reflect uncertainty in "confidence" and "notes".
- Avoid breed stereotyping; base recommendations on space size, activity level, and household fit.
- Do not fabricate. If the photos are insufficient, say so and lower confidence.
```

---

## 3. Prompt 2: breed matchmaker ("Explore breeds for my space")

1. **Rules first.** Every breed in the catalogue (3 hand-checked breeds plus up to a few
   hundred from The Dog API) is run through the same rules as §4, scored with
   `tone×10 + noise×3 + space` (−20 if the "not ready" advisory fires), and the **top 30**
   become the shortlist.
2. **Then AI.** Gemini gets the prompt below plus JSON with the household answers, a room
   summary (name, `space_summary`, physical hazard count, tag count, open-floor band) and
   the 30 candidates (name, size, energy, noise, temperament, group, and `rule_fit` bands).
3. **Checked after.** Picks whose name isn't on the shortlist are dropped, every digit is
   stripped from the text (so no numbers reach the screen), and fewer than 3 valid picks
   means the app falls back to the rules list.

```text
You are PawSpace's dog-breed matchmaker. A person is checking whether their home suits a dog. Recommend dog breeds that would genuinely suit THIS home and household.

You receive JSON with:
- "household": dwelling type, rental, how close the neighbours are, outdoor access, existing dogs.
- "room": a summary of the captured room, the number of physical hazards found, the number of valuables the user tagged, and the estimated open floor space.
- "candidates": a shortlist of real breeds. Each has name, size (small <12kg, medium 12-25kg, large >25kg), energy (low/moderate/high), noise (quiet/moderate/vocal), temperament, breed group, and "rule_fit" — how PawSpace's space rules rate it for this room (space, safety, noise: poor/adequate/good).

How to choose:
- ONLY choose breeds from "candidates". Copy each name exactly.
- Favour breeds whose rule_fit is good or adequate. Weigh: floor space vs size and energy; outdoor access vs energy (no outdoor space + high energy is a poor match); neighbour closeness vs noise (attached walls + vocal is a poor match); rentals favour smaller, quieter dogs; tagged valuables and hazards favour calmer, less destructive dogs; existing dogs favour sociable breeds.
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

## 4. The rules that decide suitability (`src/logic/evaluate.ts`, spec §4)

Three internal bands, each `poor | adequate | good`. **No number is ever shown.**

### 4.1 Breed traits

Each breed has `size` (small <12kg, medium 12–25kg, large >25kg), `energy`
(low/moderate/high) and `noise` (quiet/moderate/vocal). A **high-energy dog is treated
one size up** (small→medium, medium→large). For API breeds without trait numbers, energy
and noise are *guessed* from temperament words (`traitsEstimated`). For a mixed breed the
user enters size and energy.

### 4.2 Space Adequacy

```
open-floor ratio (OFR) = (floor_m2 − furniture_m2) / floor_m2
```

| Effective size | Poor if OFR below | Good if OFR at least AND a personal zone of at least |
|---|---|---|
| small | 0.25 | 0.40 and 0.5 m² |
| medium | 0.35 | 0.55 and 1.0 m² |
| large | 0.45 | 0.65 and 1.5 m² |

Anything in between is **adequate**. Then, with **no outdoor access** and energy that
isn't low, the band drops one step (good stays good).

> ⚠ **Room size is not measured.** There's no LiDAR, and nothing estimates it from the
> photos. Every room uses the same default: 16 m² floor, 8 m² furniture, 4 m² fixed
> furniture, 0 m² personal zone. So OFR is **always 0.50** and the personal zone is
> **always 0**, which means Space can never be "good". In practice: small and medium
> dogs always come out adequate, a large or high-energy dog is always adequate too
> (0.50 sits between 0.45 and 0.65), and no outdoor space knocks any non-low-energy dog
> to poor. **The photos have no effect on the Space band.**

### 4.3 Safety

```
hazard count = AI hazards where scope = "object" AND category ∈ A–G
               AND title doesn't start with "Flagged:"
hazard band  = 0 → good, 1–2 → adequate, 3+ → poor
tag band     = 0 tags → good, 1–3 → adequate, 4+ → poor
Safety       = the worse of the two
```

### 4.4 Noise Fit (whole home)

| Breed noise ↓ / Neighbours → | attached walls | close, separate building | not close |
|---|---|---|---|
| quiet | good | good | good |
| moderate | adequate | good | good |
| vocal | poor | adequate | good |

### 4.5 "Not ready yet" advisory

Shown only to people with **no existing dog**, when Space is poor **and** the room would
still be poor with all movable furniture cleared (`(floor − fixed) / floor` < the poor
threshold). With the fixed default room this works out to 0.75, so it never fires.

### 4.6 What the user sees

- **On this branch:** overall tone = worse of Space and Safety ("Great fit / Getting
  there / Needs work"), with chips "Spacious / Snug / Cramped", "Safe / Mostly safe /
  Hazardous" and "Good / Adequate / Poor" for noise. The dog's mood and speech follow the
  tone.
- **On local `main` (not yet merged here):** a verdict card, "Good fit / Good fit with a
  few changes / Not a good fit yet", taken from the worse of Space, Safety *and* Noise,
  plus one plain sentence listing what to change. Tagged items show "Be careful" instead
  of a severity chip.

---

## 5. Known weaknesses (what to fix with Opus)

Ordered by impact on accuracy.

**W1. The AI never estimates room size, so Space is a constant.** The rules need floor
area, furniture area, fixed-furniture area and a free "personal zone" for a bed or crate,
but nothing asks for them. *Fix:* add a `room_metrics` block to the output schema
(`floor_m2`, `furniture_m2`, `fixed_m2`, `largest_clear_area_m2`, `confidence`, plus the
cues used, e.g. "standard door ≈ 0.8 m wide"), and store it in `space.metrics`;
`estimateMetrics` already prefers it.

**W2. The prompt judges suitability, but nothing uses that judgement.** The model spends
effort on `suitability`, `score_0_100`, `improvements` and `recommended_pets`, which are
discarded. Worse, it's asked for a 0–100 score that the product rules say must never
exist. *Fix:* drop those fields, or repurpose them (for example, `improvements` becomes
the plain "what to change" list on the verdict card).

**W3. The model sees questionnaire defaults as if they were real answers.** `adults: 1`,
`children: 0`, `infant_present: false`, `activity_level: "medium"` and
`wants_apartment_friendly: true` are never asked, yet they're sent. *Fix:* send only the
five answered fields, or mark the rest `"not_asked"`.

**W4. The prompt still covers cats and other pets.** "lilies for cats", "CRITICAL for
cats", the whole of H (vertical space), and `explore` mode with `recommended_pets`, all
in a dogs-only prototype. *Fix:* make it dog-only, and rewrite H as a dog concern (for
example, furniture a dog could jump from) or remove it.

**W5. Tags are over-weighted and double-counted.** The prompt says tags are
"HIGH-PRIORITY… always address them", so the model returns them as high-severity hazards
(user testing E1: a "valuable" item shown as "needs attention"). The AI usually renames
them (e.g. "Fragile Vase", category D), so they **also count as a physical hazard** in
Safety, on top of the tag count. The tag's x,y position isn't sent either, so the
model's pin can land somewhere else. *Fix:* send the tag position; tell the model to
return tagged items with `"source": "user_tag"` and the tag's id; and treat them as
"protect this item" (risk to home) rather than a danger to the dog.

**W6. No severity rubric.** "high/medium/low" isn't defined, so the same cord can be
rated differently on different runs. *Fix:* define each level, e.g. high = could
seriously injure or kill the dog, or let it escape; medium = likely damage or minor
injury; low = nuisance.

**W7. Hazard count ignores severity and scope.** Three low-severity cords make Safety
"poor", but one high-severity unscreened balcony that the model filed as `space` (or
category L) doesn't count at all. *Fix:* in the prompt, say that escape and fall routes
are always `object` with a location; in the rules, weight by severity.

**W8. The photo-order assumption is wrong for uploads.** The prompt says photos are "a
left-to-right sweep", but uploads come in whatever order the user picked, and camera
shots are tap-by-tap. *Fix:* say "photos of the same room, in no guaranteed order; the
same object may appear in several, so report it once, in the photo where it's clearest".

**W9. Duplicates across photos.** Nothing tells the model to merge the same object seen
in overlapping photos, so it can be counted twice and push Safety down. *Fix:* see W8,
plus a "one hazard per physical object" rule.

**W10. Breed traits aren't used explicitly.** `pet` includes size, energy and noise, but
the prompt asks the model to recall "typical" breed traits itself, which can disagree
with the app's numbers. *Fix:* tell it to use the given `size/energy/noise` as ground
truth.

**W11. No schema enforcement.** JSON mode is on but no `responseSchema` is set, so
invalid enums get silently replaced by `normalise.ts` (unknown category → `I`, which
isn't counted as a hazard). *Fix:* send a Gemini `responseSchema`, or at least list every
allowed value once.

**W12. Tone of the text.** `why_it_matters` and `recommendation` appear on the risk cards
as-is. User testing found urgent phrasing alarming. *Fix:* specify voice and length
(warm, plain English, one sentence each, no ALL CAPS, no "immediately"), and say the dog
avatar speaks in first person elsewhere, so card text stays neutral.

---

## 6. Constraints any new prompt must respect

- **Dogs only** (Prototype 1).
- **Never output a numeric score** or anything that reads as one. The UI uses words only.
- **Every `object` finding needs** `frame_index` (0-based, must be less than the number of
  photos) and `x, y` in 0–1 of the **original, uncropped image** (top-left = 0,0). The
  app maps these onto cropped views.
- **Keep the output keys** `hazards[].category` (A–G count toward Safety), `scope`,
  `location`, `severity`, `title`, `why_it_matters`, `recommendation` and `space_summary`,
  or change `normalise.ts` and `types.ts` at the same time.
- **Requests must stay small:** free-tier Gemini, up to 10 images, 30-second timeout,
  up to 3 attempts.
- **No breed stereotyping**, no claims about an individual dog, and no presenting the
  result as a vet's or professional's opinion.

## 7. Suggested brief for Opus

> Here is PawSpace's current room-assessment prompt (§2.3), the rules that consume its
> output (§4), and the known weaknesses (§5). Rewrite the prompt for a dogs-only app so
> that it (1) returns room-size estimates for §4.2, (2) separates user-tagged items from
> hazards, (3) uses a defined severity rubric, (4) merges duplicates across photos,
> (5) treats the given breed traits and questionnaire answers as ground truth and ignores
> unasked fields, and (6) drops all numeric scoring. Keep the output keys listed in §6.
> Return the new prompt, the new JSON schema, and a list of code changes needed in
> `normalise.ts`, `types.ts` and `evaluate.ts`.
