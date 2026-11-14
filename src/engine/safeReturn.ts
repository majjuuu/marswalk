import type { ReturnStatus, SafeReturn, SimState, SlopeGrid, XY } from '../types';
import { O2_BASE_PER_MIN, RESERVE_MIN, TURNBACK_MARGIN_MIN, WARN_MARGIN_MIN } from './config';
import { contourRings, ringArea } from './contour';
import { dijkstra, type DijkstraResult } from './dijkstra';
import { cellCenter, cellIndexAt } from './grid';
import type { Route } from './route';
import { stepSim } from './sim';

// The return-cost field only depends on the grid + rover position, NOT on O2
// or time. So we compute it once and reuse it every sim tick (Dijkstra on
// 360k cells takes ~100 ms; the contour per tick is much cheaper).
const cache = new WeakMap<SlopeGrid, { key: string; field: DijkstraResult }>();

export function getReturnCostField(g: SlopeGrid, rover: XY): DijkstraResult {
  const key = `${rover.x},${rover.y}`;
  const hit = cache.get(g);
  if (hit && hit.key === key) return hit.field;
  const field = dijkstra(g, cellIndexAt(g, rover));
  cache.set(g, { key, field });
  return field;
}

/** O2 cost to walk from p back to the rover (Infinity if unreachable / off-grid). */
export function returnCostAt(g: SlopeGrid, rover: XY, p: XY): number {
  const i = cellIndexAt(g, p);
  return i < 0 ? Infinity : getReturnCostField(g, rover).cost[i];
}

export function statusForMargin(margin: number): ReturnStatus {
  if (margin < TURNBACK_MARGIN_MIN) return 'turnback';
  if (margin < WARN_MARGIN_MIN) return 'warn';
  return 'ok';
}

/** Where the team is on its planned route (lead astronaut's distance along it). */
export interface RoutePlan {
  route: Route;
  progress_m: number;
}

/**
 * O2 left after the furthest-out astronaut walks home, beyond the reserve.
 * The team is only as safe as its furthest-out member.
 */
export function marginFor(state: SimState, g: SlopeGrid): number {
  const worstReturn = Math.max(0, ...state.astronauts.map((a) => returnCostAt(g, state.rover, a)));
  return state.o2_min_left - RESERVE_MIN - worstReturn;
}

const FORECAST_STEP_MIN = 0.5;
const FORECAST_HORIZON_MIN = 24 * 60;

/**
 * Minutes until the margin hits 0 if the team KEEPS WALKING the planned route
 * at the sim's pace, then stands still at the end of it. That's the latest
 * moment they can start heading home.
 *
 * WHY simulate instead of a formula: walking burns extra O2 AND usually moves
 * you further from the rover, so the margin shrinks faster than "standing
 * still" suggests, and by an amount that depends on the terrain ahead.
 */
export function forecastMinutesToTurnback(state: SimState, g: SlopeGrid, plan: RoutePlan): number {
  let rt = { state, progress_m: plan.progress_m };
  let prev = marginFor(state, g);
  if (!(prev > 0)) return 0;
  for (let t = 0; t < FORECAST_HORIZON_MIN; t += FORECAST_STEP_MIN) {
    // Route finished: from here on they stand still and the margin drains at the resting rate.
    if (rt.progress_m >= plan.route.length_m) return t + prev / O2_BASE_PER_MIN;
    const next = stepSim(rt, plan.route, FORECAST_STEP_MIN, g);
    const m = marginFor(next.state, g);
    if (m <= 0) {
      // Interpolate inside this step for a smoother countdown. -Infinity means the
      // route walks somewhere with no way home, so turn back before this step.
      return Number.isFinite(m) ? t + (FORECAST_STEP_MIN * prev) / (prev - m) : t;
    }
    prev = m;
    rt = next;
  }
  return FORECAST_HORIZON_MIN;
}

export function canReturn(state: SimState, g: SlopeGrid, plan?: RoutePlan): SafeReturn {
  const field = getReturnCostField(g, state.rover);
  // Usable O2 = what's left minus the untouchable reserve.
  const budget = state.o2_min_left - RESERVE_MIN;
  const margin = marginFor(state, g);

  // Farthest straight-line distance still inside the boundary.
  let maxD2 = 0;
  for (let i = 0; i < field.cost.length; i++) {
    if (field.cost[i] <= budget) {
      const p = cellCenter(g, i);
      const d2 = (p.x - state.rover.x) ** 2 + (p.y - state.rover.y) ** 2;
      if (d2 > maxD2) maxD2 = d2;
    }
  }

  // Real terrain has lots of isolated steep 5 m cells; each would draw a tiny
  // hole. Drop rings smaller than ~20 cells so the boundary stays readable.
  const minArea = 20 * g.cell_m * g.cell_m;
  const rings = budget > 0 ? contourRings(g, field.cost, budget).filter((r) => Math.abs(ringArea(r)) >= minArea) : [];
  return {
    maxDistance_m: Math.sqrt(maxD2),
    boundaryPolygon: rings[0] ?? [],
    rings,
    status: statusForMargin(margin),
    // With a route: assume they keep walking it. Without one: assume they stand still.
    minutesToTurnback: plan
      ? forecastMinutesToTurnback(state, g, plan)
      : Number.isFinite(margin) ? Math.max(0, margin / O2_BASE_PER_MIN) : 0,
    margin_min: margin,
  };
}
