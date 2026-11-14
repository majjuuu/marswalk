import type { SimState, SlopeGrid, XY } from '../types';
import { FOLLOW_GAP_M, O2_BASE_PER_MIN, O2_EXTRA_PER_M, START_CLOCK_LOCAL, START_O2_MIN } from './config';
import { slopeO2Factor, walkSpeedMPerMin } from './cost';
import { slopeAt } from './grid';
import { pointAlong, type Route } from './route';

/** Contract state + the one extra thing the sim needs: how far along the route we are. */
export interface SimRuntime {
  state: SimState;
  progress_m: number; // lead astronaut's distance along the route
}

export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m + Math.floor(minutes)) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function initialRuntime(rover: XY, o2 = START_O2_MIN): SimRuntime {
  return {
    progress_m: 0,
    state: {
      astronauts: [{ ...rover }, { ...rover }],
      rover: { ...rover },
      o2_min_left: o2,
      elapsed_min: 0,
      clock_local: START_CLOCK_LOCAL,
    },
  };
}

/**
 * Advance the sim by dtMin minutes. Astronauts walk along the route; O2 drops
 * from breathing (always) plus walking effort (only while moving).
 * Simplification: one shared O2 number for the team (think "lowest suit").
 */
export function stepSim(rt: SimRuntime, route: Route, dtMin: number, g: SlopeGrid): SimRuntime {
  const lead = pointAlong(route, rt.progress_m);
  const slope = slopeAt(g, lead);
  const remaining = Math.max(0, route.length_m - rt.progress_m);
  const moved = Math.min(walkSpeedMPerMin(slope) * dtMin, remaining);
  const progress = rt.progress_m + moved;

  const o2Used = dtMin * O2_BASE_PER_MIN + moved * O2_EXTRA_PER_M * slopeO2Factor(slope);
  const elapsed = rt.state.elapsed_min + dtMin;

  return {
    progress_m: progress,
    state: {
      ...rt.state,
      astronauts: [pointAlong(route, progress), pointAlong(route, Math.max(0, progress - FOLLOW_GAP_M))],
      o2_min_left: Math.max(0, rt.state.o2_min_left - o2Used),
      elapsed_min: elapsed,
      clock_local: addMinutes(START_CLOCK_LOCAL, elapsed),
    },
  };
}
