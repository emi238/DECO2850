# PawSpace - Spec and User Flow Document (Prototype 1, Dogs Only)

**Team:** Fashioneurs, DECO7285 Studio 2
**Purpose:** A build-ready reference: what the app does, what it measures, and every screen a user moves through to get there. Written so it can be handed directly to whoever (or whatever) builds the screens.
**Species in scope:** Dog only, for Prototype 1.
**Feedback model:** Fully qualitative throughout. No numeric score is ever shown to the user - suitability is communicated through the animal avatar's state and descriptive report text.
**Source alignment:** Builds on the five phases and interaction principles from the submitted A1 Individual Project Proposal (Scan and Map, Personalise and Annotate, Assess and Match, Improve and Verify, Ongoing Use), extended with the evaluation logic and full screen content.
**Scope note:** This prototype assumes a single user per household uses the app, on the household's behalf. It is not assessing suitability from multiple family members' points of view, only the physical layout itself. Consent to scan and use the space is assumed to already be in place for that person.

---

## 1. Personas

| Persona | Species | Breed known? | What they get |
|---|---|---|---|
| Prospective Owner, breed in mind | Dog | Yes | A suitability assessment for that specific breed |
| Prospective Owner, no breed in mind | Dog | No | A ranked breed suggestion list |
| Current Owner | Dog | Yes, their own pet | A suitability assessment, always framed as improvement, never as a reason to give the pet up |

Only one account uses the app per household (see Section 3), so persona here just describes that one person's situation, not a household of differing viewpoints.

---

## 2. Feature, Task & Action List

Organised by phase. Each row: what the system provides (**Feature**), what the user does (**Task**), what the system does in response (**Action/Output**). IDs are referenced later in the evaluation logic and the screen-by-screen flow.

### Phase 0 - Account

| ID | Feature | Task (user) | Action/Output (system) |
|---|---|---|---|
| P0.1 | Account creation | Signs up or logs in | Creates/authenticates the user's account. One account, one scanned space: no invites, sharing, or roles in this scope |

### Phase 1 - Scan and Map

| ID | Feature | Task (user) | Action/Output (system) |
|---|---|---|---|
| P1.1 | AR space scan | Walks through the home, camera up | Builds a live 3D mesh of the home (AR/photogrammetry). All spatial data (room boundaries, floor area, furniture footprint) comes from this scan, not from any questionnaire |
| P1.2 | Room segmentation | - | Auto-segmented from the scan in the background, purely to support the evaluation logic in Section 4; not a screen the user interacts with |

### Phase 2 - Personalise and Annotate

| ID | Feature | Task (user) | Action/Output (system) |
|---|---|---|---|
| P2.1 | Tag valuables/fragile items | Taps an item, confirms/edits its name, marks it valuable/fragile | Stores the item and its height from the floor (auto-estimated or user-adjusted). This and off-limit zones are the only manual markings made during scanning; everything else the assessment needs comes from the scan itself |
| P2.2 | Mark off-limit zones | Draws/selects a room or area, marks it off-limits | Stores the zone boundary; asks whether it's closable (has a door/gate) or open |
| P2.3 | Lifestyle questionnaire | Answers the questions in Stage 1 of the flow (Section 5) | Builds the lifestyle profile used in Phase 3 |

### Phase 3 - Assess and Match

| ID | Feature | Task (user) | Action/Output (system) |
|---|---|---|---|
| P3.1 | Breed profile attachment | Enters a known breed, or picks one from a suggested list | Attaches a breed profile (size class, energy level, noise tendency) to the user's space |
| P3.2 | Breed suggestion engine | (Prospective, no breed in mind) Reviews a ranked breed list | Ranks candidate breeds/size-classes against the scanned space and lifestyle profile, using Section 4 logic |
| P3.3 | Suitability evaluation run | - | Computes Space Adequacy and Safety per room, plus a whole-home Noise Fit signal, per Section 4 |
| P3.4 | Not-ready-yet advisory | (Prospective owner only) Sees this as the lead finding when triggered | Avatar stays visibly concerned throughout the walkthrough; report leads with this finding; never appears for Current Owners (see Section 4.5) |

### Phase 4 - Improve and Verify (AR Walkthrough Feedback)

| ID | Feature | Task (user) | Action/Output (system) |
|---|---|---|---|
| P4.1 | Guided walkthrough | Moves through the home a second time, camera up | Way-point markers guide the camera toward flagged areas |
| P4.2 | In-model highlight layer | Taps a highlighted object/zone | Shows a callout card: what's flagged, why, one or two fixes (favouring non-permanent fixes where relevant) |
| P4.3 | Animal avatar | Watches the avatar move through the space | Emotion state (sad/neutral/happy) + movement style + speech-bubble callouts, per Section 4 |
| P4.4 | Outside-3D summary report | Opens the report at any point | A plain list, grouped by room, on a descriptive spectrum (cramped to spacious, hazardous to safe), no numbers |
| P4.5 | Hazard-detection disclosure | - | UI copy states hazard flagging is a best-effort supplementary layer, not a full safety sweep |
| P4.6 | Breed-bias disclaimer | - | Shown wherever a breed suggestion/assessment appears, noting breed explains only part of an individual animal's behaviour |

### Phase 5 - Ongoing Use (Pet-Proofing, Shopping, Rescan)

| ID | Feature | Task (user) | Action/Output (system) |
|---|---|---|---|
| P5.1 | Pet-item placement | Selects a catalogue item or places a generic digital object | Previews the item in the 3D space; flags placement conflicts (e.g. a water bowl blocking a walkway) |
| P5.2 | Shopping list | Adds items from placement | A consolidated list with the reason each item is recommended and where it goes |
| P5.3 | Rescan | Walks through only the changed areas | A lightweight rescan; unchanged tags/zones persist |
| P5.4 | Updated evaluation | - | Re-runs Section 4 logic on the deltas; avatar and report update to reflect the improvement |
| P5.5 | Data controls | Can delete their scan at any time | One-tap delete; raw scan data is deleted after the session by default unless the user opts to keep it for future rescans |

---

## 3. Account

One account, one user, one scanned space. This prototype assumes a single person, typically whoever manages the home, scans and reviews the space on the household's behalf. The app assesses the physical layout, not the household's makeup, so there's no invite flow, shared access, sharing between multiple people's accounts, or roles in this scope. Consent to scan and use the space is assumed to already be in place for the person using the app, so there's no separate consent screen in the flow either.

---

## 4. Suitability Evaluation Logic

This section defines what the app actually measures and how a specific measured change produces a specific feedback change, in enough detail to implement directly. None of this is shown to the user as a number, it all resolves into the qualitative avatar state and descriptive report lines from Phase 4.

### 4.1 Three internal signals

Every room the dog has access to gets two internal bands, **Poor / Adequate / Good**, recomputed on every scan and rescan:

- **Space Adequacy**: is there enough floor space, weighted by the attached breed's size and energy class. Formula in 4.2.
- **Safety**: hazards, valuables at risk, and whether off-limit zones are actually closable. Formula in 4.3.

A room's overall tone is the worse of its two bands. The avatar reflects whichever room the user is currently in during the walkthrough; the summary report lists every room's tone individually, plus which band is driving it.

A third signal, **Noise Fit** (4.4), is computed once for the whole home rather than per room, since it depends on the breed's noise tendency and how close the neighbours are, not on anything room-specific. It doesn't drive the avatar's room-by-room movement; it shows as its own line in the breed detail screen (5.2) and as a top-of-report line in the summary (6.3).

**Band to output mapping** (this is the direct trace from a measured parameter to what the user sees, for the two per-room signals):

| Band | Avatar emotion | Avatar movement | Report line style |
|---|---|---|---|
| Poor | Sad | Stiff, restrained | The "hazardous" or "cramped" end of the spectrum |
| Adequate | Neutral | Settling, cautious | Midpoint, the specific gap is named |
| Good | Happy | Relaxed, loose | The "safe" or "spacious" end of the spectrum |

Noise Fit reuses the same three-word vocabulary (Poor/Adequate/Good) for its report line, but never touches the avatar's per-room behaviour.

### 4.2 Space Adequacy

**Measured parameter:** Open Floor Ratio (OFR) = clear floor area divided by total floor area, per room, plus whether at least one zone of a minimum size is free of foot traffic (the dog's "defined personal space", distinct from OFR since a room can have a high OFR with no single quiet corner in it).

```
OFR(room) = clear_floor_area(room) / total_floor_area(room)

effective_class(breed) =
    size_class(breed) shifted up one band if energy_level(breed) == High
    else size_class(breed)

space_adequacy(room, breed) =
    Poor       if OFR(room) < poor_ceiling[effective_class]
    Good       if OFR(room) >= good_floor[effective_class] AND has_personal_space_zone(room, effective_class)
    Adequate   otherwise

if outdoor_access == None AND energy_level(breed) in {Moderate, High} AND space_adequacy != Good:
    space_adequacy = downgrade_one_band(space_adequacy)
```

**Size classes and thresholds:**

| Size class | Weight | Good (OFR at least) | Adequate (OFR between) | Poor (OFR under) | Personal-space zone required |
|---|---|---|---|---|---|
| Small | under 12kg | 40% | 25-40% | 25% | 0.5m² |
| Medium | 12-25kg | 55% | 35-55% | 35% | 1.0m² |
| Large | over 25kg | 65% | 45-65% | 45% | 1.5m² |

A high-energy dog is evaluated against the thresholds one class up (a high-energy Medium dog uses the Large row, including its 1.5m² personal-space requirement). A room can only reach Good if it also clears that zone requirement; otherwise it caps at Adequate regardless of how high the OFR is.

### 4.3 Safety

```
hazard_band(room)    = Poor if hazard_count(room) >= 3, Adequate if 1-2, Good if 0
valuables_band(room) = Poor if at_risk_count(room) >= 4, Adequate if 1-3, Good if 0

safety(room) = worse_of(hazard_band(room), valuables_band(room))
```

| Measured parameter | Poor | Adequate | Good |
|---|---|---|---|
| Hazard flags per room (CV-detected: loose cords, low sharp edges) | 3+ | 1-2 | 0 |
| Valuables at risk per room (tagged valuable, below the dog's reach height, roughly 1m: paw/mouth reach, counters included) | 4+ | 1-3 | 0 |

Off-limit zones without a closable boundary don't independently fail the Safety band, but always generate a report line prompting the user to add a physical barrier.

```
room_tone(room) = worse_of(space_adequacy(room), safety(room))
```

### 4.4 Noise Fit (whole-home, not per room)

**Measured/declared parameters:** the attached breed's noise tendency (Quiet / Moderate / Vocal, part of the breed profile, 4.6) and how close the neighbours are (from questionnaire 1.6: Attached walls / Close, separate building / Not close by).

```
noise_fit(breed, neighbour_proximity) = noise_lookup[noise_tendency(breed)][neighbour_proximity]
```

| Noise tendency \ Neighbours | Attached walls | Close, separate building | Not close by |
|---|---|---|---|
| Quiet | Good | Good | Good |
| Moderate | Adequate | Good | Good |
| Vocal | Poor | Adequate | Good |

Noise Fit doesn't change on a rescan; it only changes if the breed or the answer to 1.6 changes. It also isn't part of the not-ready-yet trigger below, a Poor Noise Fit means "consider a quieter breed for this building," not "don't get a pet."

### 4.5 "Not ready for a pet yet" advisory: trigger rule

Applies to **prospective owners only**, both with and without a breed in mind. Never applies to current owners. Based on Space Adequacy only, never on Safety or Noise Fit, since hazards are fixable and noise is a breed-choice factor rather than a question of whether the space itself can work at all.

**Trigger:** Space Adequacy is Poor in every room the pet would have access to, and a simulated "remove all non-essential furniture" pass still leaves every room below the Adequate threshold for that breed's effective class. In other words: even the best realistic version of this layout doesn't clear the bar.

**Delivery:** Non-blocking. The avatar stays visibly sad/concerned through the whole walkthrough, and the summary report leads with this as its top-line finding, but the user can still browse every room's individual feedback underneath it. Wording stays in the encouraging, first-person voice (e.g. "I'd feel cramped everywhere here right now, that could change with more room or less clutter" rather than a flat "don't get a pet").

**For current owners**, this rule never fires. A Poor band for an existing pet's space always resolves to improvement-framed feedback only (e.g. "I'd love more room to stretch, here's what might help"), consistent with the non-judgemental, never-suggest-rehoming principle.

### 4.6 Breed Profiles

Every breed (in the catalogue, or in the suggestion engine) is described by the same schema, so 4.2-4.4 can run against any of them:

| Field | Values | Used by |
|---|---|---|
| Size class | Small / Medium / Large, from weight | 4.2 |
| Energy level | Low / Moderate / High | 4.2 (class shift, outdoor-access downgrade) |
| Noise tendency | Quiet / Moderate / Vocal | 4.4 |

Three example profiles, chosen to exercise different parts of the logic:

| | French Bulldog | Border Collie | Labrador Retriever |
|---|---|---|---|
| Weight | ~11kg | ~18kg | ~29kg |
| Size class | Small | Medium | Large |
| Energy level | Low | High | Moderate |
| Effective class (4.2) | Small (no shift) | Large (shifted up from Medium) | Large (reached directly, no shift needed) |
| Noise tendency | Moderate | Vocal | Quiet |

The Border Collie is deliberately picked to be Medium-sized by weight but High-energy, so it's evaluated against the Large-dog thresholds, this is the clearest way to show the class-shift rule actually firing rather than just describing it. The Labrador Retriever is picked to land in the Large class purely on weight, with Moderate energy, so no shift mechanism is involved at all, this is the plain, unshifted path through 4.2. Its Quiet noise tendency is also the last untested cell in the 4.4 Noise Fit table, French Bulldog covers Moderate and Border Collie covers Vocal, so together the three profiles exercise every noise tendency in that table at least once. More breed profiles can be added to this table using the same fields as the catalogue grows.

### 4.7 Worked example: French Bulldog

Apartment, attached walls, no outdoor access.

**First scan, living room:** 14m² floor, 7m² furniture footprint, OFR = 50%. Small-class Good threshold is 40%+, so OFR alone clears Good, but no personal-space zone exists yet, so Space Adequacy caps at **Adequate**. 0 hazards, 0 valuables at risk, Safety = **Good**. Room tone = worse_of(Adequate, Good) = **Adequate**. Noise Fit = Moderate breed × Attached walls = **Adequate** (from the 4.4 table).

Avatar: neutral, settling. Report: *"Living room: plenty of space, just needs a spot of your own."* Top-of-report Noise Fit line: *"Should be fine with the neighbours, most of the time."*

**User action:** sets up a dog bed in a 0.6m² corner (clears the Small class's 0.5m² personal-space requirement).

**Rescan:** OFR unchanged at 50% (still above the 40% Good floor), personal-space zone now present, Space Adequacy = **Good**. Room tone = **Good**. Avatar: happy, relaxed. Report: *"Living room: everything a Frenchie needs, right where it is."* Noise Fit is unchanged at Adequate, it doesn't move on a rescan, only a breed or neighbour-proximity change would touch it.

### 4.8 Worked example: Border Collie, two homes

Same breed, two different scans, to show the app is judging the space, not the dog.

**Scenario A: a 15m² studio apartment, attached walls, no outdoor access.**
Current furniture footprint 12m² (bed, kitchenette, storage all crammed into one room), OFR = 3/15 = **20%**. Effective class is Large (High energy shifts it up), whose Poor ceiling is 45%, so 20% is **Poor**. Simulated decluttering: roughly 9m² of that footprint is fixed/non-removable (kitchenette, bathroom, bed base), so the best achievable clear floor is 6m², a maximum OFR of about 40%, still under the 45% Adequate floor even fully decluttered. The 4.5 trigger fires: this is the only room in the home and it can't clear Poor no matter what's removed.

Noise Fit = Vocal breed × Attached walls = **Poor** too, compounding the picture, but it's not what triggered the advisory (that's Space Adequacy alone, per 4.5).

Avatar: sad throughout. Report leads: *"I'd feel boxed in everywhere here, even with everything cleared out. This layout doesn't really suit a Border Collie's energy level right now."*

**Scenario B: a 3-bedroom house, private yard, detached from neighbours.**
Living room: 25m² floor, 8m² furniture footprint, OFR = **68%**, above the Large class's 65% Good floor. A 2m² reading-nook/dog-bed corner already exists, clearing the 1.5m² personal-space requirement. Space Adequacy = **Good**. Outdoor access is Private yard, so the no-outdoor-access downgrade doesn't apply. Safety: 0 hazards, Safety = **Good**. Room tone = **Good**. Noise Fit = Vocal × "Not close by" = **Good**.

Avatar: happy, relaxed, no advisory anywhere. Report: *"Plenty of room to run here, and your neighbours won't mind the barking."*

### 4.9 Worked example: Labrador Retriever

Townhouse, close to a separate neighbouring building, no outdoor access. Chosen to show the Large class reached directly from weight, with no energy-shift step to trace.

**First scan, living room:** 20m² floor, 12m² furniture footprint, OFR = 8/20 = **40%**. Large-class thresholds are 65%+ Good, 45-65% Adequate, under 45% Poor, so 40% falls just under the Adequate floor, Space Adequacy = **Poor**. Simulated decluttering: about 6m² of the footprint is fixed (kitchen units, sofa the household wants to keep), so the best achievable clear floor is 14m², OFR up to 70%, above the 65% Good floor. Since a fully decluttered pass can reach Good, the 4.5 not-ready trigger does not fire, this is a fixable Poor, not a hard one. 0 hazards, 0 valuables at risk, Safety = **Good**. Room tone = worse_of(Poor, Good) = **Poor**. Noise Fit = Quiet breed × Close separate building = **Good** (from the 4.4 table).

Avatar: sad but settled, not alarmed. Report: *"This room feels tight for a dog Lab's size right now, moving a few things could open it right up."* Top-of-report Noise Fit line: *"Barking shouldn't be a problem for the neighbours here."*

**User action:** moves a bulky sideboard out of the living room and clears a 1.5m² zone by the window (clears the Large class's 1.5m² personal-space requirement).

**Rescan:** furniture footprint drops to 8m², OFR = 12/20 = **60%**, now in the 45-65% Adequate band, and the personal-space zone is present. Space Adequacy = **Adequate**. Room tone = **Adequate**. Avatar: neutral, more settled. Report: *"Better, there's room to stretch out now, and a spot that's his alone."* Noise Fit is unchanged at Good, it doesn't move on a rescan.

---

## 5. Screen-by-Screen User Flow

This is the full path through the app, stage by stage. Persona differences are called out inline. Every question a user is asked is written out exactly as it would appear on screen, not just referenced, so this can be used as content source, not just structure.

### Stage 0: Account

**0.1 Welcome / Sign up**
- Screen title: "Welcome to PawSpace"
- Subtext: "See how ready your home is for a dog, before or after you bring one home."
- Buttons: "Create account" / "Log in"
- Sign-up fields: email or phone, password, or "Continue with Google" / "Continue with Apple"
- Leads straight to Stage 1. One account per household for this prototype; no sharing or invite step.

### Stage 1: Onboarding Questionnaire

Completed once during onboarding. Editable later from Settings (Stage 10).

**1.1 Pet status**
- Question: "Do you already have a dog, or are you thinking about getting one?"
- Options: "I already have a dog" / "I have a breed in mind" / "I'm not sure yet, suggest something"
- Branch: "I already have a dog" leads to Current Owner path. "I have a breed in mind" leads to Prospective (breed in mind). "I'm not sure yet" leads to Prospective (no breed in mind).

**1.2 Breed entry** (Current Owner, and Prospective with a breed in mind)
- Question: "What breed is your dog?" (Current Owner) or "What breed are you considering?" (Prospective)
- Searchable field with autocomplete
- Fallback: "Not sure / mixed breed" leads to "Roughly what size?" (Small, under 12kg / Medium, 12-25kg / Large, over 25kg) and "Coat length?" (Short / Long)

**1.3 Activity level**
- Question: "How much daily activity space would this dog need?"
- Options: "Low, happy to mostly relax" / "Moderate, regular play and movement" / "High, needs to run or climb often"

**1.4 Outdoor access**
- Question: "Does this home have any outdoor space your dog could use?"
- Options: "None" / "Balcony" / "Shared yard" / "Private yard"
- Covers what a separate dwelling-type question would otherwise ask; a house with a private yard and an apartment with none are already distinguished here.

**1.5 Noise and neighbours**
- Question: "How close are your nearest neighbours?"
- Options: "Attached walls (apartment or townhouse)" / "Close, but a separate building" / "Not close by"
- Feeds the Noise Fit signal (Section 4.4).

**1.6 Summary and confirm**
- Recap of every answer above, each individually editable.
- Button: "Scan your space" leads to Stage 2.

### Stage 2: Space Scan

**2.1 Scan instructions**
- Copy: "Walk slowly through your home with your camera up. We'll build a 3D map as you go - just tap to mark anything valuable or any areas that are off-limits."
- Camera/AR/motion permission prompt, if not already granted.

**2.2 Live scanning view**
- Live camera feed with the AR mesh building in real time as the user walks through.
- Progress shown as rooms/area covered, not a percentage.
- Room boundaries, floor area, and furniture placement are all captured automatically from this scan; none of it is asked as a separate question.

**2.3 Tap-to-tag: valuables and fragile items** (P2.1)
- Tap any object to mark it valuable or fragile, flagged for the "at risk" logic in Section 4.3.
- Tagging is optional per item; untagged items just don't get later interaction or warnings.
- This and off-limit zones (2.4) are the only manual markings made during scanning; everything else comes from the scan itself.

**2.4 Mark off-limit zones** (P2.2)
- Question: "Any rooms or areas this pet won't be allowed in?"
- User draws/selects a boundary, marks it off-limits.
- Follow-up: "Can this be closed off with a door or gate?" Yes / No.

**2.5 Scan review**
- Summary: rooms scanned, valuables tagged, off-limit zones marked.
- Buttons: "Rescan a room" / "Generate my space" leads to Stage 3.

### Stage 3: Processing

**3.1 Generating your space**
- Loading state while the 3D model is built and the Section 4 evaluation runs. No input required; moves automatically to Stage 4.

### Stage 4: Dashboard

**4.1 Home dashboard**
- 3D model preview of the home.
- Entry points: **Breed Suitability** (Stage 5), **AR Walkthrough Feedback** (Stage 6), **Pet-Proofing / Add Items** (Stage 7), **Shopping List** (Stage 8), **Rescan** (Stage 9).
- Not a forced sequence; this is the hub every return visit lands on.

### Stage 5: Breed Suitability Panel

Reachable at any time from the Dashboard, not gated behind the AR walkthrough.

**5.1a Prospective, no breed in mind**
- Screen title: "Breeds that could suit your space"
- A ranked list of dog breeds. Each row: breed name, thumbnail, a one-line qualitative fit summary (e.g. "Good fit, enough floor space, no noise concerns"), no score.
- Breed-bias disclaimer (P4.6) shown once at the top of the list: short note that breed only explains part of an individual animal's behaviour.
- Tap a breed leads to 5.2.

**5.1b Prospective, breed in mind**
- Opens directly into 5.2 for the breed entered in 1.2.
- If the Section 4.5 trigger fires, this is the first place it surfaces: the breed detail screen leads with the advisory line, avatar shown sad, before the per-factor breakdown underneath.

**5.1c Current Owner**
- Opens directly into 5.2 for their own dog's breed.
- The Section 4.5 advisory never appears here. Poor bands always resolve to improvement-framed lines only.

**5.2 Breed detail**
- Screen title: the breed name (or "Your [breed]" for Current Owner).
- Per-factor breakdown, each written qualitatively, not scored: Space (Section 4.2), Safety (4.3), Noise fit (4.4, a single whole-home line rather than per room).
- Specific callouts tied to the scan, e.g. "Your living room is currently the most open room, best play area."
- Button for Prospective Owner: "Choose this breed" attaches the profile (P3.1) and unlocks Stage 6.
- Button for Current Owner: "Back to dashboard" (breed is already attached).

### Stage 6: AR Walkthrough Feedback

The core "second pass" through the space: after scanning and processing, the user moves through their home again with the phone up, and feedback is mapped onto the real environment.

**6.1 Walkthrough intro**
- Copy: "Move your camera around your space to see what's changed." Way-point markers appear in the live AR view, guiding the camera toward flagged areas.

**6.2 Live AR view**
Three layers run simultaneously as the user moves:
- **In-model highlights** (P4.2): hazard spots, crowded zones, valuables at risk, off-limit boundaries, each with an AR overlay. Tap for a callout card: what it is, why it's flagged, one or two fixes.
- **Animal avatar** (P4.3): moves through the space, reflecting the current room's band from Section 4.1. Example speech bubbles: low floor space, "I need space to run"; after an improvement and a rescan, "I can run now, yay!"
- If the Section 4.5 advisory is active, the avatar stays visibly concerned throughout this entire pass.

**6.3 Outside-3D summary report** (P4.4)
- Reachable any time via a button, or shown automatically at the end of the walkthrough.
- A plain list, grouped by room, on the cramped-to-spacious / hazardous-to-safe spectrum, plus one whole-home Noise Fit line at the top (Section 4.4), separate from the per-room lines. If the Section 4.5 advisory is active, it's the first line.
- Button: "Add pet-friendly items" leads to Stage 7, or "Back to dashboard."

### Stage 7: Pet-Proofing / Add Items

**7.1 Item selection**
- Two entry modes: **Select from inventory** (a catalogue of dog items: bed, water bowl, crate, toys, etc.), or **Digitally add** (place a generic placeholder for anything not in the catalogue).

**7.2 Digital placement preview**
- AR/3D view of the item placed in the chosen spot. Drag to reposition.
- Immediate feedback on conflicts, e.g. "This spot is in a high-traffic hallway" or "No water source nearby for a bowl here."

**7.3 Placement suitability check**
- Water bowl: flags if no accessible placement was found and prompts the user to place one.
- Bed/resting spot: checks against crowded/high-traffic zones, and against the personal-space zone requirement from Section 4.2.
- Buttons: "Add to shopping list" (per item), or "Generate shopping list" leads to Stage 8.

### Stage 8: Shopping List

**8.1 Generated list**
- Every item placed in Stage 7, plus anything the app recommends that hasn't been placed yet (e.g. cord covers for a flagged hazard).
- Each line: item name, why it's recommended (tied to the flagged issue), which room it goes in.

**8.2 Checklist**
- A simple tick-off list as items are bought.

### Stage 9: Rescan Loop

**9.1 Rescan prompt**
- From the Dashboard, "Rescan." Copy: "Walk through the areas you've changed so we can update your suggestions."

**9.2 Rescan**
- Same scanning mechanism as Stage 2, scoped to changes: previously tagged items and zones persist unless the user indicates they've moved or been removed.

**9.3 Updated feedback**
- Re-runs the Section 4 evaluation, then returns to Stage 6 (or straight to the 6.3 summary) with updated results: resolved items drop off the highlight list, the avatar's mood and movement update per the new band, report lines rewrite (per the worked examples in 4.7-4.9). Noise Fit does not change on a rescan, only breed or neighbour-proximity changes touch it.
- Loop: back to Stage 7 or Stage 6 as many times as wanted, or exit to Dashboard.

### Stage 10: Settings and Data

**10.1 Data controls** (P5.5)
- "Delete my scan" (one tap).
- Retention notice: raw scan data is deleted after the session by default; a toggle lets the user keep it to make rescanning faster next time.
