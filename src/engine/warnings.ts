import type { MapPoint, SafeReturn, SimState, SlopeGrid } from '../types';
import { DUST_DEVIL_WINDOW, HAZARD_WARN_RADIUS_M, LOOKAHEAD_M, MAX_PASSABLE_SLOPE_DEG } from './config';
import { slopeAt } from './grid';
import { pointAlong, type Route } from './route';

export interface Warning {
  level: 'info' | 'warn' | 'danger';
  text: string;
}

/** Build the banner messages for the current moment. Pure: easy to test. */
export function getWarnings(
  state: SimState,
  safe: SafeReturn,
  route: Route,
  progress_m: number,
  g: SlopeGrid,
  points: MapPoint[],
): Warning[] {
  const out: Warning[] = [];
  const mins = Math.floor(safe.minutesToTurnback);

  const margin = Math.max(0, Math.floor(safe.margin_min ?? 0));
  if (safe.status === 'turnback') out.push({ level: 'danger', text: `TURN BACK NOW (${margin} min O2 margin)` });
  else if (safe.status === 'warn') out.push({ level: 'warn', text: `Turn back in ${mins} min at current pace` });

  // Scan ahead along the route for ground steeper than we can walk.
  for (let s = progress_m; s <= Math.min(route.length_m, progress_m + LOOKAHEAD_M); s += g.cell_m) {
    if (slopeAt(g, pointAlong(route, s)) > MAX_PASSABLE_SLOPE_DEG) {
      out.push({ level: 'danger', text: `Slope > ${MAX_PASSABLE_SLOPE_DEG} deg ahead` });
      break;
    }
  }

  const lead = state.astronauts[0];
  for (const h of points.filter((p) => p.type === 'hazard')) {
    if (lead && Math.hypot(lead.x - h.x, lead.y - h.y) < HAZARD_WARN_RADIUS_M) {
      out.push({ level: 'warn', text: `Near hazard: ${h.name}` });
    }
  }

  // "HH:MM" strings compare correctly as text.
  if (state.clock_local >= DUST_DEVIL_WINDOW.start && state.clock_local < DUST_DEVIL_WINDOW.end) {
    out.push({ level: 'info', text: 'Dust-devil risk window active' });
  }
  return out;
}
