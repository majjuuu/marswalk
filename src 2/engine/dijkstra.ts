import type { SlopeGrid } from '../types';
import { isPassable, walkO2Cost } from './cost';

/** Minimal binary min-heap of (cell index, priority). */
class MinHeap {
  private idx: number[] = [];
  private pri: number[] = [];
  get size() {
    return this.idx.length;
  }
  push(i: number, p: number) {
    this.idx.push(i);
    this.pri.push(p);
    let k = this.idx.length - 1;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (this.pri[parent] <= this.pri[k]) break;
      this.swap(k, parent);
      k = parent;
    }
  }
  pop(): [number, number] {
    const top: [number, number] = [this.idx[0], this.pri[0]];
    const lastI = this.idx.pop()!;
    const lastP = this.pri.pop()!;
    if (this.idx.length > 0) {
      this.idx[0] = lastI;
      this.pri[0] = lastP;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < this.idx.length && this.pri[l] < this.pri[m]) m = l;
        if (r < this.idx.length && this.pri[r] < this.pri[m]) m = r;
        if (m === k) break;
        this.swap(k, m);
        k = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.idx[a], this.idx[b]] = [this.idx[b], this.idx[a]];
    [this.pri[a], this.pri[b]] = [this.pri[b], this.pri[a]];
  }
}

// 8-connected moves: [dRow, dCol, length in cells]
const MOVES: [number, number, number][] = [
  [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
  [-1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [1, 1, Math.SQRT2],
];

export interface DijkstraResult {
  /** O2 cost (rest-minutes) from the source to each cell. Infinity = unreachable. */
  cost: Float64Array;
  /** Previous cell on the cheapest path (-1 = none). Lets us rebuild routes. */
  prev: Int32Array;
}

/**
 * Cheapest O2 cost from `source` to every cell (or until `target` is settled).
 *
 * WHY this gives "cost to get BACK to the rover": our step cost is symmetric
 * (uses the average slope of the two cells), so cost(rover -> cell) equals
 * cost(cell -> rover). One run from the rover answers the question for all cells.
 */
export function dijkstra(g: SlopeGrid, source: number, target = -1): DijkstraResult {
  const { width: W, height: H, data, cell_m } = g;
  const cost = new Float64Array(W * H).fill(Infinity);
  const prev = new Int32Array(W * H).fill(-1);
  if (source < 0) return { cost, prev };

  const heap = new MinHeap();
  cost[source] = 0;
  heap.push(source, 0);

  while (heap.size > 0) {
    const [i, d] = heap.pop();
    if (d > cost[i]) continue; // stale heap entry, already found something cheaper
    if (i === target) break;
    const r = Math.floor(i / W);
    const c = i % W;
    for (const [dr, dc, len] of MOVES) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= H || nc >= W) continue;
      const j = nr * W + nc;
      if (!isPassable(data[j])) continue;
      // Don't let diagonal moves squeeze between two wall cells.
      if (dr !== 0 && dc !== 0 && (!isPassable(data[r * W + nc]) || !isPassable(data[nr * W + c]))) continue;
      const nd = d + walkO2Cost((data[i] + data[j]) / 2, len * cell_m);
      if (nd < cost[j]) {
        cost[j] = nd;
        prev[j] = i;
        heap.push(j, nd);
      }
    }
  }
  return { cost, prev };
}
