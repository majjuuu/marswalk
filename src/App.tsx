import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Banner } from './components/Banner';
import { ModeSwitch, NavControls, PlanControls, type Mode } from './components/Controls';
import { LayerPanel } from './components/LayerPanel';
import { MapView, type LayerVisibility } from './components/MapView';
import { HoverReadout } from './components/HoverReadout';
import { ImagePanel } from './components/ImagePanel';
import { DustDevilPanel, Readout, SampleChecklist } from './components/SidePanels';
import { staticJsonSource as source } from './data/source';
import { buildRoute, canReturn, estimateRoute, getWarnings, initialRuntime, pointAlong, type Route } from './engine';
import { useSim } from './hooks/useSim';
import type { DetailIndex, ElevationGrid, MapLayer, MapPoint, SimState, SiteImage, SlopeGrid, XY } from './types';

// three.js is big: only download it when someone opens the 3D view.
const View3D = lazy(() => import('./three/View3D'));

const ROVER: XY = { x: 0, y: 0 }; // by contract the rover is the origin

export default function App() {
  const [grid, setGrid] = useState<SlopeGrid | null>(null);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('plan');
  const [waypoints, setWaypoints] = useState<XY[]>([]);
  const [layers, setLayers] = useState<LayerVisibility>({ basemap: true, slope: true, boundary: true, route: true, points: true });
  const [collected, setCollected] = useState<Record<string, boolean>>({});
  const [speed, setSpeed] = useState(2);
  const [navRoute, setNavRoute] = useState<Route | null>(null);
  const [images, setImages] = useState<SiteImage[]>([]);
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [elevation, setElevation] = useState<ElevationGrid | null>(null);
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [hover, setHover] = useState<XY | null>(null);
  const [detailIndex, setDetailIndex] = useState<DetailIndex | null>(null);
  // Base map choices; until layers.json loads (or if it's missing) just the plain basemap.
  const fallbackLayer: MapLayer = { id: 'hirise', label: 'HiRISE (grey)', src: source.basemap.url ?? '', resolution: '', citation: '' };
  const [baseLayers, setBaseLayers] = useState<MapLayer[]>([fallbackLayer]);
  const [baseId, setBaseId] = useState('hirise');

  useEffect(() => {
    Promise.all([source.loadSlope(), source.loadPoints()])
      .then(([g, pts]) => {
        setGrid(g);
        setPoints(pts);
        // Start with a sensible default plan: walk to the main target.
        const target = pts.find((p) => p.type === 'target');
        if (target) setWaypoints([{ x: target.x, y: target.y }]);
      })
      .catch((e) => setError(String(e)));
    // Images are optional: the map still works if this file is missing.
    source.loadImages().then(setImages).catch(() => setImages([]));
    // Elevation is optional too: without it the 3D button is just disabled.
    source.loadElevation().then(setElevation).catch(() => setElevation(null));
    source
      .loadLayers()
      .then((ls) => {
        setBaseLayers(ls);
        // Natural colour reads best for people; fall back to whatever comes first.
        setBaseId(ls.some((l) => l.id === 'colour') ? 'colour' : ls[0].id);
      })
      .catch(() => undefined);
  }, []);

  // High-res 3D tiles: only fetch their index once someone opens the 3D view.
  useEffect(() => {
    if (view === '3d' && !detailIndex) source.loadDetailIndex().then(setDetailIndex).catch(() => undefined);
  }, [view, detailIndex]);

  const planRoute = useMemo(() => (grid ? buildRoute(grid, ROVER, waypoints) : null), [grid, waypoints]);
  const sim = useSim(grid, navRoute, ROVER, speed);

  // Plan mode previews the boundary as it will look on ARRIVAL at the last waypoint.
  const planPreview = useMemo(() => {
    if (!grid || !planRoute) return null;
    const est = estimateRoute(grid, planRoute);
    const end = pointAlong(planRoute, planRoute.length_m);
    const start = initialRuntime(ROVER).state;
    const atArrival: SimState = { ...start, astronauts: [end, end], o2_min_left: start.o2_min_left - est.o2 };
    return { est, safe: canReturn(atArrival, grid) };
  }, [grid, planRoute]);

  const navSafe = useMemo(
    () =>
      grid && mode === 'navigate'
        ? canReturn(sim.rt.state, grid, { route: navRoute ?? planRoute!, progress_m: sim.rt.progress_m })
        : null,
    [grid, mode, sim.rt.state, sim.rt.progress_m, navRoute, planRoute],
  );

  if (error) return <div className="loading">Could not load data: {error}</div>;
  if (!grid || !planRoute) return <div className="loading">Loading terrain...</div>;

  const safe = mode === 'plan' ? planPreview?.safe ?? null : navSafe;
  const activeRoute = mode === 'plan' ? planRoute : navRoute ?? planRoute;
  const warnings = mode === 'navigate' && navSafe ? getWarnings(sim.rt.state, navSafe, activeRoute, sim.rt.progress_m, grid, points) : [];

  // EV1 looks 30 m further along the route; at the end of the route, back toward the rover.
  const lead = sim.rt.state.astronauts[0];
  const ahead = pointAlong(activeRoute, sim.rt.progress_m + 30);
  const eyeAhead = Math.hypot(ahead.x - lead.x, ahead.y - lead.y) > 1 ? ahead : ROVER;
  const addWaypoint = mode === 'plan' ? (p: XY) => setWaypoints((w) => [...w, p]) : undefined;
  const openPoint = (pt: MapPoint) => setSelected(pt.type === 'target' || pt.type === 'sample' ? pt : null);

  const base = baseLayers.find((l) => l.id === baseId) ?? baseLayers[0];
  const baseUrl = base?.src || source.basemap.url;

  const switchMode = (m: Mode) => {
    setMode(m);
    sim.reset();
    setNavRoute(m === 'navigate' ? planRoute : null);
  };

  const returnToRover = () => {
    setNavRoute(buildRoute(grid, sim.rt.state.astronauts[0], [ROVER]));
    sim.followNewRoute();
  };

  const summary = planPreview
    ? `${(planRoute.length_m / 1000).toFixed(2)} km, ~${planPreview.est.minutes.toFixed(0)} min walk, ` +
      `${planPreview.est.o2.toFixed(0)} min O2 out. Margin at arrival: ${planPreview.safe.margin_min?.toFixed(0)} min` +
      (planRoute.unreachableLegs ? ` | ${planRoute.unreachableLegs} leg(s) blocked by steep ground!` : '')
    : '';

  return (
    <div className="app">
      <header>
        <h1>Marswalk</h1>
        <span className="muted">Bright Angel / Neretva Vallis EVA (real HiRISE terrain, notional EVA)</span>
        <div className="header-right">
          <div className="segmented" title={elevation ? '' : 'No elevation.json: 3D view unavailable'}>
            <button className={view === '2d' ? 'active' : ''} onClick={() => { setView('2d'); setHover(null); }}>2D map</button>
            <button className={view === '3d' ? 'active' : ''} onClick={() => { setView('3d'); setHover(null); }} disabled={!elevation}>3D view</button>
          </div>
          <ModeSwitch mode={mode} onChange={switchMode} />
        </div>
      </header>
      <main>
        <div className="map-wrap">
          {view === '3d' && elevation ? (
            <Suspense fallback={<div className="loading">Loading 3D...</div>}>
              <View3D
                slope={grid}
                elevation={elevation}
                basemapUrl={baseUrl}
                layers={layers}
                safe={safe}
                route={activeRoute.points}
                points={points}
                astronauts={sim.rt.state.astronauts}
                eyeAhead={eyeAhead}
                tintMars={baseId === 'hirise'}
                detailIndex={detailIndex}
                detailVisible={layers.basemap && (baseId === 'colour' || baseId === 'hirise')}
                onHover={setHover}
                onTerrainClick={addWaypoint}
                onPointClick={openPoint}
              />
            </Suspense>
          ) : (
            <MapView
              grid={grid}
              basemapUrl={baseUrl}
              points={points}
              layers={layers}
              safe={safe}
              route={activeRoute.points}
              waypoints={mode === 'plan' ? waypoints : []}
              astronauts={sim.rt.state.astronauts}
              onMapClick={addWaypoint}
              onPointClick={openPoint}
              onHover={setHover}
            />
          )}
          <Banner warnings={warnings} />
          {hover && <HoverReadout p={hover} grid={grid} elevation={elevation} />}
        </div>
        <aside>
          {selected && <ImagePanel point={selected} images={images} onClose={() => setSelected(null)} />}
          {mode === 'plan' ? (
            <PlanControls
              waypointCount={waypoints.length}
              summary={summary}
              onUndo={() => setWaypoints((w) => w.slice(0, -1))}
              onClear={() => setWaypoints([])}
            />
          ) : (
            <NavControls
              playing={sim.playing}
              speed={speed}
              onPlayPause={() => sim.setPlaying(!sim.playing)}
              onReset={() => switchMode('navigate')}
              onReturn={returnToRover}
              onSpeed={setSpeed}
            />
          )}
          <Readout state={sim.rt.state} safe={safe} />
          <SampleChecklist points={points} collected={collected} onToggle={(id) => setCollected((c) => ({ ...c, [id]: !c[id] }))} />
          <DustDevilPanel clock={sim.rt.state.clock_local} />
          <LayerPanel
            layers={layers}
            onChange={setLayers}
            resolution={{ slope: `${grid.cell_m} m/cell`, basemap: base?.resolution, boundary: `${grid.cell_m} m/cell` }}
            baseLayers={baseLayers}
            baseId={baseId}
            onBaseChange={setBaseId}
          />
        </aside>
      </main>
    </div>
  );
}
