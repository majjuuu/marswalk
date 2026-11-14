import type { ReturnStatus, SafeReturn, SimState, SlopeGrid, XY } from '../types';
import { O2_BASE_PER_MIN, RESERVE_MIN, TURNBACK_MARGIN_MIN, WARN_MARGIN_MIN } from './config';
import { contourRings, ringArea } from './contour';
import { dijkstra, type DijkstraResult } from './dijkstra';
import { cellCenter, cellIndexAt } from './grid';

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

export function canReturn(state: SimState, g: SlopeGrid): SafeReturn {
  const field = getReturnCostField(g, state.rover);
  // Usable O2 = what's left minus the untouchable reserve.
  const budget = state.o2_min_left - RESERVE_MIN;

  // The team is only as safe as its furthest-out member.
  const worstReturn = Math.max(0, ...state.astronauts.map((a) => returnCostAt(g, state.rover, a)));
  const margin = budget - worstReturn;

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
    // If they stood still, margin drains at the resting rate. Walking drains it faster.
    minutesToTurnback: Number.isFinite(margin) ? Math.max(0, margin / O2_BASE_PER_MIN) : 0,
    margin_min: margin,
  };
}
