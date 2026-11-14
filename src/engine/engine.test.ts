import { describe, expect, it } from 'vitest';
import type { SimState, SlopeGrid } from '../types';
import { RESERVE_MIN, TURNBACK_MARGIN_MIN, WARN_MARGIN_MIN } from './config';
import { walkO2Cost } from './cost';
import { dijkstra } from './dijkstra';
import { cellIndexAt } from './grid';
import { buildRoute } from './route';
import { canReturn, statusForMargin } from './safeReturn';
import { initialRuntime, stepSim } from './sim';

/** Small test grid centred on (0,0). fill(r, c) gives the slope of each cell. */
function makeGrid(n: number, fill: (r: number, c: number) => number, cell_m = 5): SlopeGrid {
  const data: number[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) data.push(fill(r, c));
  return { width: n, height: n, cell_m, origin_x: (-n * cell_m) / 2, origin_y: (n * cell_m) / 2, data };
}
// The "rover" in these tests sits in the cell just south-east of (0,0).
const ROVER = { x: 0.1, y: -0.1 };
const centre = (g: SlopeGrid) => cellIndexAt(g, { x: 0.1, y: -0.1 });

function costTo(g: SlopeGrid, x: number, y: number) {
  return dijkstra(g, centre(g)).cost[cellIndexAt(g, { x, y })];
}

describe('flat ground', () => {
  const g = makeGrid(20, () => 0);
  it('straight-line cost = distance-based O2 cost', () => {
    // 8 cells east = 40 m
    expect(costTo(g, 40.1, -0.1)).toBeCloseTo(walkO2Cost(0, 40), 6);
  });
  it('diagonal moves cost sqrt(2) per cell', () => {
    expect(costTo(g, 25.1, -25.1)).toBeCloseTo(walkO2Cost(0, 5 * 5 * Math.SQRT2), 6);
  });
});

describe('slope', () => {
  it('steeper ground costs more O2 for the same distance', () => {
    const flat = makeGrid(20, () => 0);
    const hilly = makeGrid(20, () => 10);
    expect(costTo(hilly, 40.1, -0.1)).toBeGreaterThan(costTo(flat, 40.1, -0.1) * 1.5);
  });
});

describe('impassable cells', () => {
  it('a full wall (> 20 deg) makes the far side unreachable', () => {
    const g = makeGrid(20, (_r, c) => (c === 14 ? 25 : 0));
    expect(costTo(g, 40.1, -0.1)).toBe(Infinity);
  });
  it('a gap in the wall is found, at a higher cost than walking straight', () => {
    const wall = makeGrid(20, (r, c) => (c === 14 && r !== 1 ? 25 : 0));
    const open = makeGrid(20, () => 0);
    const viaGap = costTo(wall, 40.1, -0.1);
    expect(Number.isFinite(viaGap)).toBe(true);
    expect(viaGap).toBeGreaterThan(costTo(open, 40.1, -0.1));
  });
  it('exactly 20 deg is still passable', () => {
    const g = makeGrid(20, (_r, c) => (c === 14 ? 20 : 0));
    expect(Number.isFinite(costTo(g, 40.1, -0.1))).toBe(true);
  });
  it('routes go around walls', () => {
    const g = makeGrid(20, (r, c) => (c === 14 && r !== 1 ? 25 : 0));
    const route = buildRoute(g, { x: 0.1, y: -0.1 }, [{ x: 40.1, y: -0.1 }]);
    expect(route.unreachableLegs).toBe(0);
    expect(route.length_m).toBeGreaterThan(40);
  });
});

describe('status thresholds', () => {
  it('maps margin to ok / warn / turnback', () => {
    expect(statusForMargin(WARN_MARGIN_MIN + 5)).toBe('ok');
    expect(statusForMargin(WARN_MARGIN_MIN - 1)).toBe('warn');
    expect(statusForMargin(TURNBACK_MARGIN_MIN - 1)).toBe('turnback');
    expect(statusForMargin(-Infinity)).toBe('turnback');
  });

  it('canReturn: boundary shrinks and status worsens as O2 runs down', () => {
    const g = makeGrid(101, () => 0);
    const base: SimState = {
      astronauts: [{ x: 100, y: 0 }],
      rover: { x: 0.1, y: -0.1 },
      o2_min_left: 200,
      elapsed_min: 0,
      clock_local: '10:30',
    };
    const plenty = canReturn(base, g);
    const ret = walkO2Cost(0, 100); // roughly the cost home from 100 m east
    const tight = canReturn({ ...base, o2_min_left: RESERVE_MIN + ret + 5 }, g);
    expect(plenty.status).toBe('ok');
    expect(tight.status).toBe('turnback');
    expect(tight.maxDistance_m).toBeLessThan(plenty.maxDistance_m);
    expect(tight.boundaryPolygon.length).toBeGreaterThan(3);
  });
});

describe('sim', () => {
  it('O2 drops faster when walking than standing', () => {
    const g = makeGrid(40, () => 0);
    const route = buildRoute(g, { x: 0.1, y: -0.1 }, [{ x: 80, y: 0 }]);
    const still = buildRoute(g, { x: 0.1, y: -0.1 }, []);
    const walking = stepSim(initialRuntime(ROVER, 100), route, 1, g);
    const standing = stepSim(initialRuntime(ROVER, 100), still, 1, g);
    expect(standing.state.o2_min_left).toBeCloseTo(99, 6);
    expect(walking.state.o2_min_left).toBeLessThan(standing.state.o2_min_left);
    expect(walking.progress_m).toBeGreaterThan(30);
  });
});
