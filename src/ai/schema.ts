// Output contract for the room prompt (logic v2, CHANGE PRD 15 Oct 2026 §4/§6).
//
// One list of allowed values per field, shared by:
//  - ROOM_RESPONSE_SCHEMA, sent to Gemini as `responseSchema` so the model can
//    only return valid JSON with these values (W11), and
//  - normalise.ts, which checks them again in case a reply still slips through.

export const CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'] as const;
export const HAZARD_TYPES = [
  'escape_fall',
  'toxic_ingestible',
  'electrical_thermal',
  'floor_stairs',
  'fragile_valuable',
  'clutter',
  'other',
] as const;
export const SEVERITIES = ['low', 'medium', 'high'] as const;
export const CONFIDENCES = ['low', 'medium', 'high'] as const;
export const RISK_TO = ['animal', 'home', 'both'] as const;
export const SOURCES = ['photo', 'user_tag'] as const;
export const SCOPES = ['object', 'space'] as const;
export const OPENNESS = ['open', 'moderate', 'cramped'] as const;
export const RETREAT = ['present', 'possible', 'absent'] as const;
export const CLEAR_PATH = ['good', 'partial', 'poor'] as const;
export const FLOOR_TYPES = ['hard', 'mixed', 'soft', 'unknown'] as const;
export const ESCAPE_TYPES = ['balcony', 'window', 'door', 'fence', 'stairs'] as const;
export const OFF_LIMIT_ZONES = ['kitchen', 'balcony', 'nursery', 'office', 'stairs', 'other'] as const;
export const DOG_SPOT_PURPOSES = ['bed', 'crate', 'food_water', 'play'] as const;
export const SAFETY_ADDITION_TYPES = ['gate', 'railing', 'netting', 'window_guard', 'pen', 'cord_cover', 'non_slip_mat', 'other'] as const;
// Most suggestions of each kind kept (the prompt asks for the same limits).
export const MAX_OFF_LIMITS = 3;
export const MAX_DOG_SPOTS = 3;
export const MAX_SAFETY_ADDITIONS = 5;
export const SIGNAL_PETS = ['dog', 'cat', 'multiple', 'none', 'unknown'] as const;
export const SIGNAL_CHILDREN = ['yes', 'no', 'unknown'] as const;
export const SIGNAL_DWELLING = ['apartment', 'house', 'unknown'] as const;
export const SIGNAL_OUTDOOR = ['yard', 'balcony', 'none', 'unknown'] as const;

// ---- Gemini Schema objects (OpenAPI subset: upper-case types, enum, nullable,
// required, propertyOrdering). Keep it flat and small: very large or deeply
// nested schemas are rejected by the API.

type Props = Record<string, object>;

const str = (description?: string) => ({ type: 'STRING', ...(description ? { description } : {}) });
const oneOf = (values: readonly string[], description?: string) => ({
  type: 'STRING',
  enum: [...values],
  ...(description ? { description } : {}),
});
const num = (description?: string) => ({ type: 'NUMBER', ...(description ? { description } : {}) });
const int = (description?: string) => ({ type: 'INTEGER', ...(description ? { description } : {}) });
const bool = (description?: string) => ({ type: 'BOOLEAN', ...(description ? { description } : {}) });
const list = (items: object, description?: string) => ({ type: 'ARRAY', items, ...(description ? { description } : {}) });
const obj = (properties: Props, optional: string[] = [], extra: object = {}) => ({
  type: 'OBJECT',
  properties,
  required: Object.keys(properties).filter((k) => !optional.includes(k)),
  propertyOrdering: Object.keys(properties),
  ...extra,
});

const LOCATION = obj(
  {
    frame_index: int('0-based index of the photo'),
    x: num('0 to 1 across the original, uncropped photo (0 = left)'),
    y: num('0 to 1 down the original, uncropped photo (0 = top)'),
    bbox: list(num(), '[x, y, w, h], each 0 to 1'),
  },
  ['bbox'],
  { nullable: true, description: 'Required for scope "object"; null for scope "space".' }
);

const HAZARD = obj({
  object_key: str('short stable lowercase name of the physical object, same in every photo'),
  title: str('2-5 plain words naming the object and where it is'),
  source: oneOf(SOURCES),
  hazard_type: oneOf(HAZARD_TYPES),
  category: oneOf(CATEGORIES, 'checklist letter'),
  scope: oneOf(SCOPES),
  location: LOCATION,
  risk_to: oneOf(RISK_TO),
  severity: oneOf(SEVERITIES),
  confidence: oneOf(CONFIDENCES),
  small_dog_risk: bool(),
  easy_fix: bool(),
  tag_id: str('the tag id for source "user_tag", otherwise ""'),
  evidence: str(),
  why_it_matters: str(),
  recommendation: str(),
});

const ESCAPE_ROUTE = obj({
  object_key: str('same key as its hazards entry'),
  type: oneOf(ESCAPE_TYPES),
  detail: str(),
  frame_index: int(),
  x: num(),
  y: num(),
  severity: oneOf(SEVERITIES),
  confidence: oneOf(CONFIDENCES),
  small_dog_risk: bool(),
});

export const ROOM_RESPONSE_SCHEMA = obj({
  space_summary: str('1-2 sentences describing the room'),
  confidence: oneOf(CONFIDENCES),
  hazards: list(HAZARD),
  room_assessment: obj({
    openness: oneOf(OPENNESS),
    retreat_spot: oneOf(RETREAT),
    clear_path: oneOf(CLEAR_PATH),
    floor_type: oneOf(FLOOR_TYPES),
    floor_area_m2: obj({
      value: { type: 'NUMBER', nullable: true, description: 'square metres, or null if you cannot tell' },
      confidence: oneOf(CONFIDENCES),
    }),
  }),
  escape_routes: list(ESCAPE_ROUTE),
  off_limit_suggestions: list(
    obj({
      zone: oneOf(OFF_LIMIT_ZONES),
      reason: str(),
      frame_index: int(),
      x: num('where the area is, 0 to 1 across the photo'),
      y: num('0 to 1 down the photo'),
    })
  ),
  dog_spots: list(
    obj({
      purpose: oneOf(DOG_SPOT_PURPOSES),
      reason: str(),
      frame_index: int(),
      x: num('where it would go, 0 to 1 across the photo'),
      y: num('0 to 1 down the photo'),
    })
  ),
  safety_additions: list(
    obj({
      type: oneOf(SAFETY_ADDITION_TYPES),
      detail: str('what exactly, e.g. "a pressure-fit gate across the kitchen doorway"'),
      reason: str(),
      frame_index: int(),
      x: num('where it would go, 0 to 1 across the photo'),
      y: num('0 to 1 down the photo'),
    })
  ),
  detected_signals: obj({
    existing_pets: oneOf(SIGNAL_PETS),
    children: oneOf(SIGNAL_CHILDREN),
    dwelling_cue: oneOf(SIGNAL_DWELLING),
    outdoor_access_cue: oneOf(SIGNAL_OUTDOOR),
  }),
  improvements: list(str(), 'up to 5 specific changes, most important first'),
  notes: str(),
});
