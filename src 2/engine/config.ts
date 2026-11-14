// All tunable constants in one place. EVERY VALUE IS A PLACEHOLDER until the
// science/ops team gives us real numbers. Change them here, not in the logic.

/** Walking speed on flat ground. Apollo EVAs averaged ~2-3 km/h. */
export const WALK_SPEED_FLAT_KMH = 2;
/** Speed is divided by (1 + slope / this). At 10 deg you walk half speed. */
export const SLOPE_SPEED_DIVISOR_DEG = 10;

/** Steeper than this = treated as a wall. Slope is "> 20" so exactly 20 is OK. */
export const MAX_PASSABLE_SLOPE_DEG = 20;

/** o2_min_left is measured in "minutes at rest", so resting burns 1 per minute. */
export const O2_BASE_PER_MIN = 1;
/** Extra O2 (in rest-minutes) per meter walked on flat ground. 1 km = +10 min. */
export const O2_EXTRA_PER_M = 0.01;
/** Walking O2 is multiplied by (1 + slope / this): climbing is hard work. */
export const SLOPE_O2_DIVISOR_DEG = 10;

/** O2 we never plan to use: you must be home with this much left. */
export const RESERVE_MIN = 30;
/** Status thresholds on the margin (O2 left after getting home, beyond reserve). */
export const WARN_MARGIN_MIN = 20;
export const TURNBACK_MARGIN_MIN = 10;

// ---- simulation defaults ---------------------------------------------------
export const START_O2_MIN = 240;
export const START_CLOCK_LOCAL = '10:30';
/** Astronaut 2 trails astronaut 1 by this many meters along the route. */
export const FOLLOW_GAP_M = 15;
/** How far ahead along the route we look for steep ground / hazards. */
export const LOOKAHEAD_M = 60;
export const HAZARD_WARN_RADIUS_M = 80;

// ---- hard-coded environment (will come from a forecast later) --------------
export const DUST_DEVIL_WINDOW = { start: '12:00', end: '14:00', label: 'High risk 12:00-14:00 local' };
