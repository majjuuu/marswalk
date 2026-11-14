import * as THREE from 'three';
import type { DetailIndex, SlopeGrid, XY } from '../types';
import { composeTileTexture, loadImage } from './textures';

/*
 * High-resolution close-up terrain: 1 m heights + 25 cm imagery in 512 m tiles
 * around the work area (made by data-pipeline/make_detail_tiles.py).
 * The 5 m base terrain still covers everything; where a tile exists, the base
 * is sunk a few metres underneath so the sharp tile is what you see.
 */

interface Tile {
  id: string;
  x0: number; // local x of the west edge (first vertex column)
  y0: number; // local y of the north edge (first vertex row)
  heights: Float32Array; // metres relative to the rover, row 0 = north
  photo: HTMLImageElement;
  mesh: THREE.Mesh;
}

export class DetailTiles {
  readonly group = new THREE.Group();
  private tiles: Tile[] = [];
  private size: number;
  private n: number;
  private cell: number;
  private disposed = false;

  constructor(private index: DetailIndex, private grid: SlopeGrid, private anisotropy: number) {
    this.size = index.size_m;
    this.n = index.vertices;
    this.cell = index.cell_m;
  }

  get count() {
    return this.tiles.length;
  }

  private tileAt(p: XY): Tile | undefined {
    return this.tiles.find((t) => p.x >= t.x0 && p.x <= t.x0 + this.size && p.y <= t.y0 && p.y >= t.y0 - this.size);
  }

  /** Height in metres from the 1 m tiles (bilinear), or null where there's no tile. */
  heightAt(p: XY): number | null {
    const t = this.tileAt(p);
    if (!t) return null;
    const fc = (p.x - t.x0) / this.cell;
    const fr = (t.y0 - p.y) / this.cell;
    const c0 = Math.min(this.n - 2, Math.max(0, Math.floor(fc)));
    const r0 = Math.min(this.n - 2, Math.max(0, Math.floor(fr)));
    const tc = fc - c0;
    const tr = fr - r0;
    const h = (r: number, c: number) => t.heights[r * this.n + c];
    const top = h(r0, c0) * (1 - tc) + h(r0, c0 + 1) * tc;
    const bottom = h(r0 + 1, c0) * (1 - tc) + h(r0 + 1, c0 + 1) * tc;
    return top * (1 - tr) + bottom * tr;
  }

  /** True if p is inside a loaded tile by at least `margin` metres (used to sink the base). */
  covers(p: XY, margin: number): boolean {
    return [
      { x: p.x - margin, y: p.y - margin },
      { x: p.x + margin, y: p.y - margin },
      { x: p.x - margin, y: p.y + margin },
      { x: p.x + margin, y: p.y + margin },
    ].every((q) => this.tileAt(q) !== undefined);
  }

  /**
   * Fetch tiles nearest-first so the ground under EV1 sharpens first.
   * `onTile` runs after each one so the scene can re-drape lines on it.
   */
  async load(near: XY, exag: number, slope: HTMLImageElement | null, onTile: () => void) {
    const centre = (t: DetailIndex['tiles'][number]) => Math.hypot(t.x0 + this.size / 2 - near.x, t.y0 - this.size / 2 - near.y);
    const queue = [...this.index.tiles].sort((a, b) => centre(a) - centre(b));
    for (const info of queue) {
      const [buf, photo] = await Promise.all([fetch(info.dem).then((r) => r.arrayBuffer()), loadImage(info.tex)]);
      if (this.disposed) return;
      const raw = new Int16Array(buf);
      const heights = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) heights[i] = raw[i] * this.index.height_unit_m;
      const mesh = new THREE.Mesh(
        new THREE.BufferGeometry(),
        // polygonOffset: where tile and base terrain are at nearly the same depth, the tile wins.
        new THREE.MeshLambertMaterial({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }),
      );
      const tile: Tile = { id: info.id, x0: info.x0, y0: info.y0, heights, photo, mesh };
      this.tiles.push(tile);
      this.buildGeometry(tile, exag);
      this.setTexture(tile, slope);
      this.group.add(mesh);
      onTile();
    }
  }

  private buildGeometry(t: Tile, exag: number) {
    const n = this.n;
    const pos = new Float32Array(n * n * 3);
    const uv = new Float32Array(n * n * 2);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        pos[i * 3] = t.x0 + c * this.cell;
        pos[i * 3 + 1] = t.heights[i] * exag;
        pos[i * 3 + 2] = -(t.y0 - r * this.cell);
        uv[i * 2] = c / (n - 1);
        uv[i * 2 + 1] = 1 - r / (n - 1);
      }
    }
    const idx = new Uint32Array((n - 1) * (n - 1) * 6);
    let k = 0;
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const a = r * n + c, b = a + 1, d = a + n, e = d + 1;
        idx.set([a, d, b, b, d, e], k);
        k += 6;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    t.mesh.geometry.dispose();
    t.mesh.geometry = geo;
  }

  private setTexture(t: Tile, slope: HTMLImageElement | null) {
    const g = this.grid;
    const crop = {
      sx: (t.x0 - g.origin_x) / g.cell_m,
      sy: (g.origin_y - t.y0) / g.cell_m,
      sw: this.size / g.cell_m,
      sh: this.size / g.cell_m,
    };
    const tex = new THREE.CanvasTexture(composeTileTexture(t.photo, slope, crop));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.anisotropy; // keeps ground sharp at grazing angles (eye view)
    const mat = t.mesh.material as THREE.MeshLambertMaterial;
    mat.map?.dispose();
    mat.map = tex;
    mat.needsUpdate = true;
  }

  setExaggeration(exag: number) {
    this.tiles.forEach((t) => this.buildGeometry(t, exag));
  }

  setSlopeOverlay(slope: HTMLImageElement | null) {
    this.tiles.forEach((t) => this.setTexture(t, slope));
  }

  dispose() {
    this.disposed = true;
    for (const t of this.tiles) {
      t.mesh.geometry.dispose();
      const mat = t.mesh.material as THREE.MeshLambertMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
    this.group.clear();
    this.tiles = [];
  }
}
