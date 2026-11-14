import {
  MAX_PASSABLE_SLOPE_DEG,
  O2_BASE_PER_MIN,
  O2_EXTRA_PER_M,
  SLOPE_O2_DIVISOR_DEG,
  SLOPE_SPEED_DIVISOR_DEG,
  WALK_SPEED_FLAT_KMH,
} from './config';

// The physics-ish model. Pure functions so they are easy to unit test.

export function isPassable(slopeDeg: number): boolean {
  return slopeDeg <= MAX_PASSABLE_SLOPE_DEG;
}

/** Walking speed in meters per minute on a given slope. */
export function walkSpeedMPerMin(slopeDeg: number): number {
  const flat = (WALK_SPEED_FLAT_KMH * 1000) / 60;
  return flat / (1 + slopeDeg / SLOPE_SPEED_DIVISOR_DEG);
}

export function slopeO2Factor(slopeDeg: number): number {
  return 1 + slopeDeg / SLOPE_O2_DIVISOR_DEG;
}

/**
 * O2 (rest-minutes) used to walk `dist_m` on `slopeDeg`.
 * Two parts: you breathe while time passes, AND walking itself costs extra.
 * Slopes hurt twice: slower (more time) and harder (more effort per meter).
 */
export function walkO2Cost(slopeDeg: number, dist_m: number): number {
  const minutes = dist_m / walkSpeedMPerMin(slopeDeg);
  return minutes * O2_BASE_PER_MIN + dist_m * O2_EXTRA_PER_M * slopeO2Factor(slopeDeg);
}
