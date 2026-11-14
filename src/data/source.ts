import type { DetailIndex, ElevationGrid, MapLayer, MapPoint, SiteImage, SlopeGrid } from '../types';

/**
 * Everything the app knows about the outside world comes through this interface.
 * Today it reads fake static JSON; later swap in real files (same format) or a
 * different implementation (e.g. live telemetry) without touching the UI.
 */
export interface DataSource {
  loadPoints(): Promise<MapPoint[]>;
  loadSlope(): Promise<SlopeGrid>;
  loadImages(): Promise<SiteImage[]>;
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

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const staticJsonSource: DataSource = {
  loadPoints: () => getJson<MapPoint[]>('/data/points.json'),
  loadSlope: () => getJson<SlopeGrid>('/data/slope.json'),
  loadImages: () => getJson<SiteImage[]>('/data/images.json'),
  loadElevation: () => getJson<ElevationGrid>('/data/elevation.json'),
  loadLayers: () => getJson<MapLayer[]>('/data/layers.json'),
  loadDetailIndex: () => getJson<DetailIndex>('/data/detail/tiles.json'),
  // HiRISE ortho (USGS Jezero mosaic, 25 cm) resampled to 2 m. Set url: null
  // to fall back to the generated placeholder.
  basemap: { url: '/data/basemap.png', label: 'Basemap: HiRISE ortho, 2 m/px' },
};
