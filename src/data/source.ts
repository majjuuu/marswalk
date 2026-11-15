import type { DetailIndex, ElevationGrid, MapLayer, MapPoint, ScienceNote, SiteImage, SlopeGrid } from '../types';

/**
 * Everything the app knows about the outside world comes through this interface.
 * Today it reads fake static JSON; later swap in real files (same format) or a
 * different implementation (e.g. live telemetry) without touching the UI.
 */
export interface DataSource {
  loadPoints(): Promise<MapPoint[]>;
  loadSlope(): Promise<SlopeGrid>;
  loadImages(): Promise<SiteImage[]>;
  loadScience(): Promise<ScienceNote[]>;
  /** Only needed by the 3D view. */
  loadElevation(): Promise<ElevationGrid>;
  /** Base map choices. Falls back to just `basemap` if layers.json is missing. */
  loadLayers(): Promise<MapLayer[]>;
  /** High-res 3D tiles; only fetched when the eye view opens. */
  loadDetailIndex(): Promise<DetailIndex>;
  basemap: BasemapInfo;
}

export interface BasemapInfo {
  /** Image URL covering the slope grid's extent, or null = draw a placeholder. */
  url: string | null;
  label: string;
}

/**
 * Data files use site-root paths like "/data/slope.json". When the app is
 * hosted in a sub-folder (GitHub Pages serves it at /marswalk/), those need
 * the folder in front. Vite's BASE_URL is "/" locally and "/marswalk/" there.
 */
export function asset(p: string): string {
  return p.startsWith('/') ? import.meta.env.BASE_URL + p.slice(1) : p;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(asset(url));
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const staticJsonSource: DataSource = {
  loadPoints: () => getJson<MapPoint[]>('/data/points.json'),
  loadSlope: () => getJson<SlopeGrid>('/data/slope.json'),
  // Paths inside these files are site-root too, so fix them up as they load.
  loadImages: () => getJson<SiteImage[]>('/data/images.json').then((l) => l.map((i) => ({ ...i, src: asset(i.src) }))),
  loadScience: () => getJson<ScienceNote[]>('/data/science.json'),
  loadElevation: () => getJson<ElevationGrid>('/data/elevation.json'),
  loadLayers: () => getJson<MapLayer[]>('/data/layers.json').then((l) => l.map((x) => ({ ...x, src: asset(x.src) }))),
  loadDetailIndex: () =>
    getJson<DetailIndex>('/data/detail/tiles.json').then((d) => ({
      ...d,
      tiles: d.tiles.map((t) => ({ ...t, dem: asset(t.dem), tex: asset(t.tex) })),
    })),
  // HiRISE ortho (USGS Jezero mosaic, 25 cm) resampled to 2 m. Set url: null
  // to fall back to the generated placeholder.
  basemap: { url: asset('/data/basemap.png'), label: 'Basemap: HiRISE ortho, 2 m/px' },
};
