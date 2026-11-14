import type { SlopeGrid, XY, XYPair } from '../types';
import { walkO2Cost, walkSpeedMPerMin } from './cost';
import { dijkstra } from './dijkstra';
import { cellCenter, cellIndexAt, slopeAt } from './grid';

export interface Route {
  points: XYPair[];
  /** cumLen[i] = distance along the route to points[i]. */
  cumLen: number[];
  length_m: number;
  /** Legs we couldn't path around walls; drawn as straight lines (unsafe!). */
  unreachableLegs: number;
}

/** Cheapest walkable path a -> b, or null if b can't be reached. */
function legPath(g: SlopeGrid, a: XY, b: XY): XYPair[] | null {
  const src = cellIndexAt(g, a);
  const dst = cellIndexAt(g, b);
  if (src < 0 || dst < 0) return null;
  const { prev, cost } = dijkstra(g, src, dst);
  if (!Number.isFinite(cost[dst])) return null;
  const cells: number[] = [];
  for (let i = dst; i !== -1; i = prev[i]) cells.push(i);
  cells.reverse();
  // Use the exact clicked points at both ends, cell centres in between.
  const mid = cells.slice(1, -1).map((i) => {
    const p = cellCenter(g, i);
    return [p.x, p.y] as XYPair;
  });
  return [[a.x, a.y], ...mid, [b.x, b.y]];
}

export function buildRoute(g: SlopeGrid, start: XY, waypoints: XY[]): Route {
  const pts: XYPair[] = [[start.x, start.y]];
  let unreachableLegs = 0;
  let from = start;
  for (const wp of waypoints) {
    const leg = legPath(g, from, wp);
    if (leg) pts.push(...leg.slice(1));
    else {
      unreachableLegs++;
      pts.push([wp.x, wp.y]);
    }
    from = wp;
  }
  const cumLen = [0];
  for (let i = 1; i < pts.length; i++) {
    cumLen.push(cumLen[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return { points: pts, cumLen, length_m: cumLen[cumLen.length - 1], unreachableLegs };
}

/** Position `s` meters along the route (clamped to the ends). */
export function pointAlong(route: Route, s: number): XY {
  const { points, cumLen } = route;
  if (points.length === 0) return { x: 0, y: 0 };
  if (s <= 0 || points.length === 1) return { x: points[0][0], y: points[0][1] };
  if (s >= route.length_m) {
    const last = points[points.length - 1];
    return { x: last[0], y: last[1] };
  }
  // Binary search for the segment containing s.
  let lo = 0;
  let hi = cumLen.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumLen[mid] <= s) lo = mid;
    else hi = mid;
  }
  const seg = cumLen[hi] - cumLen[lo] || 1;
  const t = (s - cumLen[lo]) / seg;
  return {
    x: points[lo][0] + t * (points[hi][0] - points[lo][0]),
    y: points[lo][1] + t * (points[hi][1] - points[lo][1]),
  };
}

/** Walk the route in small steps to estimate total time and O2 (for Plan mode). */
export function estimateRoute(g: SlopeGrid, route: Route, step_m = 5) {
  let minutes = 0;
  let o2 = 0;
  for (let s = 0; s < route.length_m; s += step_m) {
    const ds = Math.min(step_m, route.length_m - s);
    const slope = slopeAt(g, pointAlong(route, s + ds / 2));
    minutes += ds / walkSpeedMPerMin(slope);
    o2 += walkO2Cost(slope, ds);
  }
  return { minutes, o2 };
}
