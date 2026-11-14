import type { SlopeGrid, XYPair } from '../types';

/**
 * Marching squares: trace the line where `values` crosses `threshold`.
 * Returns closed rings in local meters. "Inside" = value <= threshold.
 *
 * Sample points are cell centres. We pretend there is a ring of "outside"
 * cells around the grid so every contour closes into a loop.
 */
export function contourRings(g: SlopeGrid, values: Float64Array, threshold: number): XYPair[][] {
  const { width: W, height: H, cell_m, origin_x, origin_y } = g;
  // Infinity breaks interpolation, so cap values at something clearly "outside".
  const CAP = Math.abs(threshold) * 2 + 1000;
  const val = (r: number, c: number) =>
    r < 0 || c < 0 || r >= H || c >= W ? CAP : Math.min(values[r * W + c], CAP);
  const px = (c: number) => origin_x + (c + 0.5) * cell_m;
  const py = (r: number) => origin_y - (r + 0.5) * cell_m;

  // Each grid edge gets a unique number so neighbouring squares can be stitched.
  const PW = W + 2;
  const hKey = (r: number, c: number) => ((r + 1) * PW + (c + 1)) * 2; // (r,c)->(r,c+1)
  const vKey = (r: number, c: number) => hKey(r, c) + 1; // (r,c)->(r+1,c)

  const pos = new Map<number, XYPair>();
  const adj = new Map<number, number[]>();
  const t = threshold;
  const lerp = (a: number, b: number) => (a === b ? 0.5 : (t - a) / (b - a));

  const link = (a: number, b: number) => {
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  };

  for (let r = -1; r < H; r++) {
    for (let c = -1; c < W; c++) {
      const tl = val(r, c), tr = val(r, c + 1), br = val(r + 1, c + 1), bl = val(r + 1, c);
      const code = (tl <= t ? 8 : 0) | (tr <= t ? 4 : 0) | (br <= t ? 2 : 0) | (bl <= t ? 1 : 0);
      if (code === 0 || code === 15) continue;

      const T = hKey(r, c), B = hKey(r + 1, c), L = vKey(r, c), R = vKey(r, c + 1);
      if (!pos.has(T)) pos.set(T, [px(c) + lerp(tl, tr) * cell_m, py(r)]);
      if (!pos.has(B)) pos.set(B, [px(c) + lerp(bl, br) * cell_m, py(r + 1)]);
      if (!pos.has(L)) pos.set(L, [px(c), py(r) - lerp(tl, bl) * cell_m]);
      if (!pos.has(R)) pos.set(R, [px(c + 1), py(r) - lerp(tr, br) * cell_m]);

      // Standard 16-case table (corner bits: tl=8 tr=4 br=2 bl=1).
      switch (code) {
        case 1: case 14: link(L, B); break;
        case 2: case 13: link(B, R); break;
        case 3: case 12: link(L, R); break;
        case 4: case 11: link(T, R); break;
        case 6: case 9: link(T, B); break;
        case 7: case 8: link(T, L); break;
        case 5: link(T, R); link(L, B); break; // saddle
        case 10: link(T, L); link(B, R); break; // saddle
      }
    }
  }

  // Walk the graph: every crossing edge has exactly 2 neighbours -> loops.
  const rings: XYPair[][] = [];
  const seen = new Set<number>();
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const ring: XYPair[] = [];
    let prev = -1;
    let cur = start;
    while (!seen.has(cur)) {
      seen.add(cur);
      ring.push(pos.get(cur)!);
      const nbrs = adj.get(cur)!;
      const next = nbrs[0] !== prev ? nbrs[0] : nbrs[1];
      prev = cur;
      cur = next;
    }
    if (ring.length >= 3) rings.push(ring);
  }
  // Biggest first: that's the outer boundary; Leaflet draws the rest as holes.
  rings.sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)));
  return rings;
}

/** Shoelace formula (signed area). */
export function ringArea(ring: XYPair[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}
