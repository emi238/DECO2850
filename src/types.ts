// Data model for a PawSpace session (PRD §6) and the AI assessment schema (PRD §7.2).

import type { RunChanges, RunSnapshot } from './logic/changes';

export type Mode = 'pet_in_mind' | 'explore';

export type Severity = 'low' | 'medium' | 'high';
export type Confidence = 'low' | 'medium' | 'high';

// A captured frame. For real camera captures `uri` is a file:// path.
export interface Frame {
  uri: string;
  // base64 is kept in memory only (never persisted) for the real-AI path.
  base64?: string;
  // image mime type of the base64 bytes (camera/upload = jpeg).
  mime?: string;
}

export interface Pet {
  species: string;
  breed: string; // catalogue breed name, or free text for a mixed breed
  size?: 'small' | 'medium' | 'large'; // entered for mixed breeds (spec §1.2)
  energy?: 'low' | 'moderate' | 'high'; // user-picked activity level (spec §1.3)
  noise?: 'quiet' | 'moderate' | 'vocal'; // saved at selection so API breeds work offline
  imageUrl?: string; // Dog API photo, for breeds without built-in art
}

// Estimated room measurements used by the Space Adequacy rule (spec §4.2).
export interface SpaceMetrics {
  floor_m2: number;
  furniture_m2: number;
  fixed_m2: number; // footprint that can't be decluttered (kitchenette, bed base…)
  personal_zone_m2: number; // largest quiet spot free of foot traffic
  estimated: boolean;
}

export interface ExistingPet {
  species: string;
  breed: string;
}

export type Neighbours = 'attached' | 'close_separate' | 'not_close';
export type ChildrenAtHome = 'none' | 'young' | 'older'; // young = any child under 5
export type HoursAlone = 'under_4' | '4_to_8' | 'over_8'; // a typical weekday
// Logic v2 (CHANGE PRD 15 Oct 2026 §3).
export type OutdoorUse = 'most_days' | 'sometimes' | 'rarely'; // will the dog actually use the outdoor space?
export type AlonePlan = 'none' | 'walker' | 'daycare'; // who checks in on long days alone
export type OwnerActivity = 'sedentary' | 'moderate' | 'active';
export type ExerciseTime = 'under_30' | '30_60' | 'over_60'; // minutes a day of walks/play
export type Experience = 'none' | 'some'; // first dog / has owned a dog before
export type Atmosphere = 'calm' | 'mixed' | 'busy';
// Pets other than dogs (dogs are listed separately in existing_pets).
export type OtherPet = 'cat' | 'bird' | 'small_animal' | 'fish' | 'reptile' | 'other';

// The size of dog the owner would like ('any' = no preference). Asked 28 Oct 2026.
export type SizePreference = 'small' | 'medium' | 'large' | 'any';

export interface Questionnaire {
  dwelling: 'apartment' | 'house';
  rental: boolean;
  neighbours: Neighbours; // nearest-neighbour proximity (Noise Fit)
  floor_level: number | null; // only meaningful for apartments
  outdoor_access: 'none' | 'balcony' | 'shared yard' | 'private yard' | 'pool';
  adults: number;
  children: number;
  children_ages: string; // rough, free text e.g. "2, 5"
  infant_present: boolean;
  existing_pets: ExistingPet[];
  off_limit_zones: string[];
  activity_level: 'low' | 'medium' | 'high';
  wants_apartment_friendly: boolean;
  // Asked since user testing (Oct 2026). Optional so older saved answers still load.
  children_at_home?: ChildrenAtHome;
  hours_alone?: HoursAlone;
  // Logic v2 (15 Oct 2026). Optional for the same reason; unanswered = undefined.
  outdoor_use?: OutdoorUse; // only asked when outdoor_access isn't "none"
  alone_plan?: AlonePlan;
  owner_activity?: OwnerActivity;
  exercise_time?: ExerciseTime;
  experience?: Experience;
  household_atmosphere?: Atmosphere;
  allergies?: boolean;
  // "Do you have any other pets?" and, if yes, which kinds. Replaced "Do you have a
  // cat?" (has_cat) on 15 Oct 2026; saved has_cat answers are converted on load.
  has_other_pets?: boolean;
  other_pets?: OtherPet[];
  size_preference?: SizePreference;
}

export interface Tag {
  id: string;
  label: string;
  note: string;
  frame: number; // frame index the tag was placed on
  // Approximate normalised position on that frame [0,1], if placed by tap.
  x?: number;
  y?: number;
  // An area the owner wants the dog kept out of (from ar-immersive-scan 51d2e26),
  // rather than a valuable/fragile item. frame -1 = not tied to a photo (marked in the
  // 3D view, which has since been removed; only older saved tags have this).
  offLimits?: boolean;
}

// ---- AI assessment schema (PRD §7.2) ----

export type HazardCategory =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N';

export interface HazardLocation {
  frame_index: number;
  x: number; // normalised [0,1]
  y: number; // normalised [0,1]
  bbox?: [number, number, number, number];
}

// Which Safety group a finding belongs to (logic v2 §2.3 type weights).
export type HazardType =
  | 'escape_fall'
  | 'toxic_ingestible'
  | 'electrical_thermal'
  | 'floor_stairs'
  | 'fragile_valuable'
  | 'clutter'
  | 'other'; // not a physical danger (room size, noise, household): not in the Safety load

export interface Hazard {
  id: string;
  category: HazardCategory;
  title: string;
  scope: 'object' | 'space';
  location: HazardLocation | null; // null when scope = "space"
  risk_to: 'animal' | 'home' | 'both';
  severity: Severity;
  evidence: string;
  why_it_matters: string;
  recommendation: string;
  // Logic v2. Optional because results saved before 15 Oct 2026 don't have them;
  // normalise.ts always fills them for new results.
  object_key?: string; // stable name for the physical object (dedup + Re-run comparison)
  source?: 'photo' | 'user_tag';
  confidence?: Confidence;
  hazard_type?: HazardType;
  small_dog_risk?: boolean; // a gap a small dog could squeeze through / object it could swallow
  easy_fix?: boolean; // quick and cheap to fix (move, tidy, close)
  tag_id?: string; // the user's tag this entry answers (source = user_tag)
}

// Logic v2: the room as a place for this dog to live (qualitative, from the photos).
export interface RoomAssessment {
  openness: 'open' | 'moderate' | 'cramped';
  retreat_spot: 'present' | 'possible' | 'absent';
  clear_path: 'good' | 'partial' | 'poor';
  floor_type: 'hard' | 'mixed' | 'soft' | 'unknown';
  floor_area_m2: { value: number | null; confidence: Confidence };
}

export interface EscapeRoute {
  object_key: string;
  type: 'balcony' | 'window' | 'door' | 'fence' | 'stairs';
  detail: string;
  frame_index: number;
  x: number;
  y: number;
  severity: Severity;
  confidence: Confidence;
  small_dog_risk: boolean;
}

// Suggested setup (15 Oct 2026): where to keep the dog out, where the dog's things
// could go, and what to add for safety. x,y (0-1 of the photo) mark the spot on the
// map; without them the suggestion is listed but not pinned.
export interface OffLimitSuggestion {
  zone: 'kitchen' | 'balcony' | 'nursery' | 'office' | 'stairs' | 'other';
  reason: string;
  frame_index: number;
  x?: number;
  y?: number;
}

export interface DogSpot {
  purpose: 'bed' | 'crate' | 'food_water' | 'play';
  reason: string;
  frame_index: number;
  x?: number;
  y?: number;
}

export interface SafetyAddition {
  type: 'gate' | 'railing' | 'netting' | 'window_guard' | 'pen' | 'cord_cover' | 'non_slip_mat' | 'other';
  detail: string; // what exactly, e.g. "a pressure-fit gate across the kitchen doorway"
  reason: string;
  frame_index: number;
  x?: number;
  y?: number;
}

// What the photos suggest about the household, to cross-check the questionnaire.
export interface DetectedSignals {
  existing_pets: 'dog' | 'cat' | 'multiple' | 'none' | 'unknown';
  children: 'yes' | 'no' | 'unknown';
  dwelling_cue: 'apartment' | 'house' | 'unknown';
  outdoor_access_cue: 'yard' | 'balcony' | 'none' | 'unknown';
}

export interface Suitability {
  verdict: 'well_suited' | 'suitable_with_changes' | 'poorly_suited';
  score_0_100: number;
  rationale: string;
}

export interface RecommendedPet {
  species: string;
  breed: string;
  why: string;
  caveats: string;
}

// Can the model actually see a room in the photos? (blank, black or dark frames,
// a blurry mess, or no room at all → not usable, and the owner is told to retake.)
export type PhotoIssue = 'none' | 'blank' | 'too_dark' | 'blurry' | 'not_a_room';
export interface PhotoCheck {
  usable: boolean;
  issue: PhotoIssue;
  note: string;
}

export interface Assessment {
  mode: Mode;
  space_summary: string;
  confidence: 'low' | 'medium' | 'high';
  hazards: Hazard[];
  improvements: string[];
  // Logic v2: the model no longer judges suitability (the rules own the verdict),
  // so new results always have suitability null and recommended_pets [].
  suitability: Suitability | null;
  recommended_pets: RecommendedPet[];
  notes: string;
  // Logic v2. Optional: results saved before 15 Oct 2026 don't have them.
  room_assessment?: RoomAssessment;
  escape_routes?: EscapeRoute[];
  off_limit_suggestions?: OffLimitSuggestion[];
  dog_spots?: DogSpot[];
  safety_additions?: SafetyAddition[];
  detected_signals?: DetectedSignals;
  photo_check?: PhotoCheck; // missing on results saved before 21 Oct 2026 = usable
}

export interface Session {
  session_id: string;
  created_at: string;
  capture: {
    frames: Frame[];
    panorama: string | null;
  };
  mode: Mode | null;
  pet: Pet | null;
  questionnaire: Questionnaire;
  tags: Tag[];
  result: Assessment | null;
}

// A single captured space (living room, garage, …). The app manages many of
// these; each carries its own capture, pet, questionnaire, tags and result.
export interface Space {
  id: string;
  name: string;
  created_at: string;
  capture: {
    frames: Frame[];
    panorama: string | null;
  };
  mode: Mode | null;
  pet: Pet | null;
  questionnaire: Questionnaire;
  tags: Tag[];
  result: Assessment | null;
  // Whether `result` came from the real model or the built-in sample, plus any
  // fallback note — remembered so the map banner reads correctly after reload.
  resultSource?: 'ai' | 'mock';
  resultNote?: string;
  label?: string; // Living Room / Kitchen / Bedroom (Space Saved screen)
  saved?: boolean; // finished the capture flow (hides half-made spaces on Home)
  visits?: number; // for "Most Frequently Visited Space"
  metrics?: SpaceMetrics;
  // "What's new": what the user saw after the last run, and what the latest Re-run
  // changed compared with the run before it (cleared by any other kind of run).
  runSnapshot?: RunSnapshot;
  lastChanges?: RunChanges;
}
