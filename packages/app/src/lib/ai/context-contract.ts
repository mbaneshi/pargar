/**
 * AIContext — the single, authoritative contract between the CAD system and any AI model.
 *
 * Rules:
 * 1. This is the ONLY data the AI receives about the drawing. If it's not here, the AI can't know it.
 * 2. Building this must be deterministic — no AI, no randomness, no network calls.
 * 3. Total serialized size must stay under TOKEN_BUDGET (default ~3000 tokens ≈ 12KB).
 * 4. Every field has a clear reason. If you can't explain why the AI needs it, remove it.
 * 5. This contract is versioned. Changing it changes AI behavior — treat it like a breaking API change.
 */

// --- Token budget ---
export const CONTEXT_TOKEN_BUDGET = 3000;
export const CONTEXT_VERSION = '0.1.0';

// --- Core contract ---

export interface AIContext {
  version: string;
  scene: SceneContext;
  focus: FocusContext;
  interaction: InteractionContext;
  settings: SettingsContext;
}

/** High-level scene overview. Always included. Cheap (~200-400 tokens). */
export interface SceneContext {
  /** Human-readable summary: "12 entities across 3 layers" */
  summary: string;
  /** Entity type → count: { Line: 5, Circle: 3, Rectangle: 2 } */
  entity_counts: Record<string, number>;
  /** All layers with metadata */
  layers: LayerSummary[];
  /** Axis-aligned bounding box of all entities, null if empty drawing */
  bounds: BoundingBox | null;
  /** Total entity count (redundant but cheap, saves model arithmetic) */
  total_entities: number;
}

/** What the user is focused on — spatially and by selection. Most expensive section. */
export interface FocusContext {
  /** Currently selected entities — full geometry detail */
  selected: EntitySummary[];
  /** Last N entities created or modified (most recent first). Max 5. */
  recent: EntitySummary[];
  /** Current viewport in world coordinates */
  viewport: ViewportInfo;
  /** Entities visible in viewport (summarized, not full detail). Max 20. */
  nearby: EntityBrief[];
}

/** User's current interaction state — what are they doing right now? */
export interface InteractionContext {
  /** Active tool: "LINE", "CIRCLE", "SELECT", or null (idle) */
  active_tool: string | null;
  /** Last command the user or agent executed */
  last_command: string | null;
  /** Shell mode: "IDLE" | "TOOL_ACTIVE" | "AWAITING_INPUT" */
  mode: string;
}

/** Drawing-wide settings that affect how geometry should be created. */
export interface SettingsContext {
  /** Drawing units display format */
  units: string;
  /** Active layer ID — new entities go here */
  active_layer: string;
  /** Grid snap spacing, null if grid is off */
  grid_spacing: number | null;
  /** Object snap enabled */
  snap_enabled: boolean;
  /** Orthographic constraint enabled */
  ortho_enabled: boolean;
}

// --- Supporting types ---

export interface LayerSummary {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  entity_count: number;
}

export interface BoundingBox {
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
}

export interface ViewportInfo {
  center_x: number;
  center_y: number;
  width: number;
  height: number;
}

/**
 * Full entity summary — used for selected/recent entities where the AI needs
 * to understand geometry precisely enough to reason about modifications.
 *
 * Key design choice: `description` is a human-readable string, NOT raw JSON geometry.
 * "Line from (-15, -10) to (15, 10), length 36.06" is more useful to the AI
 * than { "Line": { "start": { "x": -15, "y": -10 }, "end": { "x": 15, "y": 10 } } }
 * AND it costs fewer tokens.
 */
export interface EntitySummary {
  id: string;
  type: string;
  layer: string;
  description: string;
}

/**
 * Brief entity reference — used for nearby entities where the AI needs
 * spatial awareness but not full detail. Even cheaper than EntitySummary.
 */
export interface EntityBrief {
  id: string;
  type: string;
  layer: string;
  /** One-line position hint: "Circle at (0, 0) r=8" */
  position: string;
}

// --- Summarization rules ---

/**
 * Priority order for what to include when approaching token budget:
 * 1. scene (always — it's tiny)
 * 2. interaction (always — it's tiny)
 * 3. settings (always — it's tiny)
 * 4. focus.selected (always — this is what the user cares about)
 * 5. focus.recent (include up to 5)
 * 6. focus.viewport (always)
 * 7. focus.nearby (include up to 20, truncate first)
 *
 * If budget is exceeded, truncate in reverse order (nearby first, then recent).
 */
export const PRIORITY_ORDER = [
  'scene',
  'interaction',
  'settings',
  'focus.selected',
  'focus.recent',
  'focus.viewport',
  'focus.nearby',
] as const;
