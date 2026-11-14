import { useEffect, useMemo, useRef, useState } from 'react';
import { placeholderBasemapUrl, slopeHeatmapUrl } from '../components/rasters';
import type { LayerVisibility } from '../components/MapView';
import { MAP_COLORS } from '../theme';
import type { DetailIndex, ElevationGrid, MapPoint, SafeReturn, SlopeGrid, XY, XYPair } from '../types';
import { MarsScene, type CameraMode } from './MarsScene';
import { composeTerrainTexture } from './textures';

interface Props {
  slope: SlopeGrid;
  elevation: ElevationGrid;
  basemapUrl: string | null;
  /** Warm-tint a greyscale base map so it reads as Mars. */
  tintMars: boolean;
  /** 1 m / 25 cm close-up tiles (optional) and whether the base map allows them (photos only). */
  detailIndex: DetailIndex | null;
  detailVisible: boolean;
  layers: LayerVisibility;
  safe: SafeReturn | null;
  route: XYPair[];
  points: MapPoint[];
  astronauts: XY[];
  /** Point EV1 is walking towards (a bit further along the route). */
  eyeAhead: XY;
  onTerrainClick?: (p: XY) => void;
  onPointClick?: (p: MapPoint) => void;
  onHover?: (p: XY | null) => void;
}

/** React wrapper: owns one MarsScene and feeds it props through setters. */
export default function View3D(p: Props) {
  const box = useRef<HTMLDivElement>(null);
  const scene = useRef<MarsScene | null>(null);
  const [camera, setCamera] = useState<CameraMode>('overview');
  const [exag, setExag] = useState(1.5);

  // Callbacks change every render; keep the latest in a ref so the scene
  // (created once) always calls the current one.
  const cbs = useRef(p);
  cbs.current = p;

  useEffect(() => {
    const s = new MarsScene(box.current!, p.elevation, {
      onTerrainClick: (pt) => cbs.current.onTerrainClick?.(pt),
      onHover: (pt) => cbs.current.onHover?.(pt),
      onLabelClick: (id) => {
        const pt = cbs.current.points.find((x) => x.id === id);
        if (pt) cbs.current.onPointClick?.(pt);
      },
    });
    scene.current = s;
    return () => {
      s.dispose();
      scene.current = null;
    };
  }, [p.elevation]);

  // Terrain texture = basemap (or flat colour) + optional slope heatmap.
  const slopeUrl = useMemo(() => slopeHeatmapUrl(p.slope), [p.slope]);
  const baseUrl = useMemo(() => p.basemapUrl ?? placeholderBasemapUrl(p.slope), [p.basemapUrl, p.slope]);
  useEffect(() => {
    let cancelled = false;
    composeTerrainTexture(p.layers.basemap ? baseUrl : null, p.layers.slope ? slopeUrl : null).then((canvas) => {
      if (!cancelled) scene.current?.setTexture(canvas, p.layers.basemap && p.tintMars);
    });
    return () => {
      cancelled = true;
    };
  }, [baseUrl, slopeUrl, p.layers.basemap, p.layers.slope, p.tintMars, p.elevation]);

  // In eye view, real 1x heights: exaggeration would make every slope look like a cliff.
  useEffect(() => scene.current?.setExaggeration(camera === 'eye' ? 1 : exag), [exag, camera, p.elevation]);
  useEffect(() => scene.current?.setCameraMode(camera), [camera, p.elevation]);
  useEffect(() => scene.current?.setRoute(p.layers.route ? p.route : []), [p.route, p.layers.route, p.elevation]);
  useEffect(() => scene.current?.setPoints(p.layers.points ? p.points : []), [p.points, p.layers.points, p.elevation]);
  useEffect(() => {
    const rings = p.layers.boundary && p.safe?.rings ? p.safe.rings : [];
    const color = MAP_COLORS[p.safe?.status ?? 'ok'];
    scene.current?.setLive(rings, color, p.astronauts);
  }, [p.safe, p.astronauts, p.layers.boundary, p.elevation]);
  useEffect(() => scene.current?.setEyeAhead(p.eyeAhead), [p.eyeAhead]);

  // Sharp close-up tiles: start streaming as soon as the index is known, nearest EV1 first.
  useEffect(() => {
    if (p.detailIndex) scene.current?.loadDetail(p.detailIndex, cbs.current.astronauts[0] ?? { x: 0, y: 0 });
  }, [p.detailIndex, p.elevation]);
  useEffect(() => scene.current?.setDetailVisible(p.detailVisible), [p.detailVisible, p.elevation]);
  useEffect(() => {
    scene.current?.setDetailSlopeOverlay(p.layers.slope ? slopeUrl : null);
  }, [p.layers.slope, slopeUrl, p.elevation]);

  return (
    <div className="view3d" ref={box}>
      <div className="view3d-controls panel">
        <div className="segmented">
          <button className={camera === 'overview' ? 'active' : ''} onClick={() => setCamera('overview')}>Overview</button>
          <button className={camera === 'eye' ? 'active' : ''} onClick={() => setCamera('eye')}>EV1 eye view</button>
        </div>
        {camera === 'overview' ? (
          <>
            <label className="row">
              <span>Height x{exag.toFixed(1)}</span>
              <input type="range" min={1} max={4} step={0.5} value={exag} onChange={(e) => setExag(Number(e.target.value))} />
            </label>
            <button onClick={() => scene.current?.resetOverview()}>Reset camera</button>
            <small className="muted">Drag to orbit, scroll to zoom. Plan mode: click the ground to add a waypoint.</small>
          </>
        ) : (
          <small className="muted">1.7 m eye height, true scale. Drag to look around. Faces along the route.</small>
        )}
      </div>
    </div>
  );
}
