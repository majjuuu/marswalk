import { useEffect, useMemo, useState } from 'react';
import { Banner } from './components/Banner';
import { ModeSwitch, NavControls, PlanControls, type Mode } from './components/Controls';
import { LayerPanel } from './components/LayerPanel';
import { MapView, type LayerVisibility } from './components/MapView';
import { DustDevilPanel, Readout, SampleChecklist } from './components/SidePanels';
import { staticJsonSource as source } from './data/source';
import { buildRoute, canReturn, estimateRoute, getWarnings, initialRuntime, pointAlong, type Route } from './engine';
import { useSim } from './hooks/useSim';
import type { MapPoint, SimState, SlopeGrid, XY } from './types';

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
  }, []);

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

  const navSafe = useMemo(() => (grid && mode === 'navigate' ? canReturn(sim.rt.state, grid) : null), [grid, mode, sim.rt.state]);

  if (error) return <div className="loading">Could not load data: {error}</div>;
  if (!grid || !planRoute) return <div className="loading">Loading terrain...</div>;

  const safe = mode === 'plan' ? planPreview?.safe ?? null : navSafe;
  const activeRoute = mode === 'plan' ? planRoute : navRoute ?? planRoute;
  const warnings = mode === 'navigate' && navSafe ? getWarnings(sim.rt.state, navSafe, activeRoute, sim.rt.progress_m, grid, points) : [];

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
        <span className="muted">Bright Angel / Neretva Vallis EVA (FAKE DATA)</span>
        <ModeSwitch mode={mode} onChange={switchMode} />
      </header>
      <main>
        <div className="map-wrap">
          <MapView
            grid={grid}
            basemapUrl={source.basemap.url}
            points={points}
            layers={layers}
            safe={safe}
            route={activeRoute.points}
            waypoints={mode === 'plan' ? waypoints : []}
            astronauts={sim.rt.state.astronauts}
            onMapClick={mode === 'plan' ? (p) => setWaypoints((w) => [...w, p]) : undefined}
          />
          <Banner warnings={warnings} />
        </div>
        <aside>
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
            resolution={{ slope: `${grid.cell_m} m/cell`, basemap: source.basemap.label.replace('Basemap: ', ''), boundary: `${grid.cell_m} m/cell` }}
          />
        </aside>
      </main>
    </div>
  );
}
