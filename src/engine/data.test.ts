// Sanity checks on whatever is in public/data. Re-run after swapping in real data.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MapPoint, SlopeGrid } from '../types';
import { elevationAt } from './grid';
import { buildRoute, estimateRoute } from './route';
import { canReturn } from './safeReturn';
import { initialRuntime } from './sim';

const grid: SlopeGrid = JSON.parse(readFileSync('public/data/slope.json', 'utf8'));
const points: MapPoint[] = JSON.parse(readFileSync('public/data/points.json', 'utf8'));

describe('public/data', () => {
  it('elevation grid (if present) sits on exactly the slope grid, rover at 0 m', () => {
    if (!existsSync('public/data/elevation.json')) return;
    const elev: SlopeGrid = JSON.parse(readFileSync('public/data/elevation.json', 'utf8'));
    for (const k of ['width', 'height', 'cell_m', 'origin_x', 'origin_y'] as const) expect(elev[k]).toBe(grid[k]);
    expect(elev.data.length).toBe(elev.width * elev.height);
    expect(Math.abs(elevationAt(elev, { x: 0, y: 0 }))).toBeLessThan(2);
  });

  it('slope grid matches its declared size', () => {
    expect(grid.data.length).toBe(grid.width * grid.height);
  });

  it('has exactly one rover at the origin', () => {
    const rovers = points.filter((p) => p.type === 'rover');
    expect(rovers).toHaveLength(1);
    expect([rovers[0].x, rovers[0].y]).toEqual([0, 0]);
  });

  it('the main target is reachable on foot and the start boundary covers it', () => {
    const target = points.find((p) => p.type === 'target')!;
    const route = buildRoute(grid, { x: 0, y: 0 }, [target]);
    expect(route.unreachableLegs).toBe(0);
    const est = estimateRoute(grid, route);
    console.log(`route ${route.length_m.toFixed(0)} m, ${est.minutes.toFixed(0)} min, ${est.o2.toFixed(0)} O2-min`);
    const safe = canReturn(initialRuntime({ x: 0, y: 0 }).state, grid);
    expect(safe.maxDistance_m).toBeGreaterThan(Math.hypot(target.x, target.y));
  });
});
