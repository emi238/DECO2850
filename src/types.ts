// Data model for a PawSpace session (PRD §6) and the AI assessment schema (PRD §7.2).

export type Mode = 'pet_in_mind' | 'explore';

export type Severity = 'low' | 'medium' | 'high';

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
}

export interface Tag {
  id: string;
  label: string;
  note: string;
  frame: number; // frame index the tag was placed on
  // Approximate normalised position on that frame [0,1], if placed by tap.
  x?: number;
  y?: number;
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

export interface Assessment {
  mode: Mode;
  space_summary: string;
  confidence: 'low' | 'medium' | 'high';
  hazards: Hazard[];
  improvements: string[];
  suitability: Suitability | null; // null in explore mode
  recommended_pets: RecommendedPet[]; // [] in pet_in_mind mode
  notes: string;
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
}
