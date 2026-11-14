import type { SlopeGrid, XY } from '../types';

// Helpers to go between local meters and grid cells.
// Row 0 is the NORTH edge, so y DEcreases as the row number increases.

export function cellCenter(g: SlopeGrid, idx: number): XY {
  const r = Math.floor(idx / g.width);
  const c = idx % g.width;
  return { x: g.origin_x + (c + 0.5) * g.cell_m, y: g.origin_y - (r + 0.5) * g.cell_m };
}

/** Cell index containing (x, y), or -1 if outside the grid. */
export function cellIndexAt(g: SlopeGrid, p: XY): number {
  const c = Math.floor((p.x - g.origin_x) / g.cell_m);
  const r = Math.floor((g.origin_y - p.y) / g.cell_m);
  if (r < 0 || c < 0 || r >= g.height || c >= g.width) return -1;
  return r * g.width + c;
}

/** Slope at a point; outside the grid we assume flat (nothing better to say). */
export function slopeAt(g: SlopeGrid, p: XY): number {
  const i = cellIndexAt(g, p);
  return i < 0 ? 0 : g.data[i];
}

/** Bounds as [[south, west], [north, east]] in local meters. */
export function gridExtent(g: SlopeGrid) {
  return {
    west: g.origin_x,
    east: g.origin_x + g.width * g.cell_m,
    north: g.origin_y,
    south: g.origin_y - g.height * g.cell_m,
  };
}
