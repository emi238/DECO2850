// Data model for a PawSpace session (PRD §6) and the AI assessment schema (PRD §7.2).

export type Mode = 'pet_in_mind' | 'explore';

export type Severity = 'low' | 'medium' | 'high';

// A captured frame. For real camera captures `uri` is a file:// path.
// For the bundled demo room, `uri` is a "demo:N" sentinel rendered as SVG.
export interface Frame {
  uri: string;
  // base64 is kept in memory only (never persisted) for the real-AI path.
  base64?: string;
  // image mime type of the base64 bytes (camera = jpeg, rasterised demo = png).
  mime?: string;
}

export interface Pet {
  species: string;
  breed: string;
}

export interface ExistingPet {
  species: string;
  breed: string;
}

export interface Questionnaire {
  dwelling: 'apartment' | 'house';
  rental: boolean;
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
