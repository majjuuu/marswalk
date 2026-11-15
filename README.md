# Marswalk

Planning + live-navigation map for a 2-astronaut Mars EVA at the **Bright Angel** outcrop
(Jezero Crater, Neretva Vallis). The core feature is a **safe-return boundary**: the area
you can still walk back to the rover from, given remaining O2 and terrain slope. It shrinks
as the EVA goes on and turns yellow, then red.

> **Terrain is real, the EVA is notional.** Slope and basemap come from the USGS HiRISE
> Jezero mosaics; Cheyava Falls is placed from Perseverance's waypoints. The rover spot,
> samples, hazards, O2 constants and dust-devil forecast are placeholders. See "What's real".

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 (Vite default)
npm test         # unit tests (Vitest)
npm run lint
npm run build
npm run data:demo  # back to the FAKE demo data (needs python3, no extra packages)
```

**Try it:** the app opens in **Plan** mode with a route to Cheyava Falls. Click the map to add
waypoints. Switch to **Navigate**, set speed to 10, press **Play**: astronauts walk, O2 drops,
the boundary shrinks and changes colour, and banners fire.

**3D view:** switch "2D map / 3D view" in the header.
- **Overview:** orbit the real terrain (drag, scroll), with adjustable height exaggeration.
  In Plan mode, clicking the ground adds a waypoint; clicking a target/sample label opens its images.
- **Close-up detail:** around the rover, target and samples (2 x 1.5 km) the 3D view streams
  1 m terrain and 25 cm HiRISE imagery tiles, nearest EV1 first. Elsewhere it's 5 m / 2 m.
- **Explore:** walk anywhere on foot at 1.7 m: click the ground or the minimap to go there,
  drag to look around; hover shows the O2 cost to walk home from any spot.
- **Minimap:** top right in 3D, with your position, a heading cone, the rover and the boundary.
- **EV1 eye view:** first-person at 1.7 m, true scale, facing along the route. It follows EV1
  while the sim runs. Drag to look around. A compass at the bottom shows the direction and
  distance to the rover.

## Folder map

```
src/
  types.ts            shared data contract (TypeScript)
  theme.ts            map colours (UI colours are CSS variables in styles.css)
  App.tsx             wires data + engine + components together
  engine/             pure logic, no React. Unit-tested.
    config.ts         ALL tunable constants (speeds, O2 rates, thresholds)
    cost.ts           walking speed + O2 cost on a slope
    dijkstra.ts       cheapest-path search on the slope grid
    safeReturn.ts     canReturn(): boundary, status, minutes to turnback
    contour.ts        marching squares: cost field -> boundary polygon
    route.ts          waypoints -> walkable route
    sim.ts            one sim tick (walk + burn O2)
    warnings.ts       banner messages
  components/         React UI (map, panels, banner)
  data/source.ts      DataSource interface: the ONLY place that loads data
  hooks/useSim.ts     runs the sim on a timer
  three/              3D view (three.js), loaded only when opened
    MarsScene.ts      terrain mesh, draped lines, markers, cameras
    View3D.tsx        React wrapper + camera controls
public/data/          points.json, slope.json (the app's inputs)
data-pipeline/        Python scripts: HiRISE -> public/data (stubbed, has --demo)
docs/CONTRACT.md      the data contract
```

## Data contract (short version)

- Local meters, `(0,0)` = rover, `x` east, `y` north.
- `points.json`: `[{ id, name, type: rover|target|sample|hazard, x, y, note? }]`
- `slope.json`: `{ width, height, cell_m, origin_x, origin_y, data }`, row 0 = north.
- `canReturn(state, grid, plan?) -> { maxDistance_m, boundaryPolygon, status, minutesToTurnback }`

Full version: [docs/CONTRACT.md](docs/CONTRACT.md).

**Pitch prep:** [docs/PITCH_BRIEF.md](docs/PITCH_BRIEF.md) has the demo script, architecture, numbers, slide outline and likely judge questions.

## How the safe-return boundary works

1. Each step between neighbouring cells costs O2 = breathing for the time it takes
   (slower on slopes) + walking effort (harder on slopes). Slopes > 20 deg are walls.
2. Dijkstra from the rover gives the cheapest O2 cost from **every** cell back to the rover.
   This only depends on terrain, so it's computed once and cached.
3. Each tick: `budget = O2 left - 30 min reserve`. Cells with cost <= budget are inside;
   marching squares traces the edge into a polygon.
4. `margin = budget - cost home for the furthest astronaut`. < 20 min = warn, < 10 = turn back.

## What's real

| Thing | Now | Source / caveat |
|---|---|---|
| Slope grid | **Real.** 580x580 @ 5 m around the rover | USGS controlled HiRISE Jezero DTM (1 m) -> Horn slope -> 5 m mean. DTM noise inflates slope; `--agg max` is the cautious option |
| Basemap | **Real.** 2 m/px | USGS HiRISE Jezero ortho mosaic (25 cm) |
| Cheyava Falls | **Real** (to ~tens of m) | Perseverance waypoint, sols 1210-1218 |
| Site images | **Real** NASA releases | PIA26401 (Mastcam-Z, sol 1217) and PIA26368 (WATSON, sol 1212) in `public/data/images.json`; click Cheyava Falls or a sample |
| Natural colour | **Real**, ~50 m colour + 2 m detail | HRSC colour mosaic (UDL Lyon) pan-sharpened with HiRISE |
| Minerals | **Real**, ~18-36 m | CRISM dominant-mineral map (Saranathan, Parente & Itoh), official key; 37% of area matched |
| Thermal inertia | **Real**, ~100 m | THEMIS mosaic (Edwards & Buz); high = rocky, low = dusty/sandy |
| Rover spot | Notional | Perseverance's sol 1120 stop, ~1.05 km ESE |
| Samples, hazards | Notional | hand-placed near real features |
| Distances | ~5% too long east-west | source projection is equirectangular with lat_ts=0; at 18.5 N that stretches E-W by 1/cos(18.5) |
| O2 / speed constants | round placeholder numbers (`config.ts`) | from EVA physiology references |
| Dust devils | hard-coded "12:00-14:00" | forecast / climatology |
| O2 | one shared number for the team | per-suit telemetry |

## Credits

- From **gloriachang's `hud` branch**: free-roam first-person exploring, the minimap with a
  heading cone, mission objectives that tick themselves off, and the Cheyava Falls mineral
  write-up (re-checked against NASA PIA26640 and Hurowitz et al. 2025, Nature). Ported onto
  Marswalk's real grid; her illustrative viewpoints and placeholder diagrams were not used.

- The natural-colour, mineral and thermal layers, and the hover lat/lon readout, are ported
  from **Mughani05's [marswalk3d](https://github.com/Mughani05/marswalk3d)** (layer sources,
  HSV pan-sharpening, thermal colour ramp). Here they are regenerated on Marswalk's own
  Bright Angel grid by `data-pipeline/make_layers.py`.
- Data: USGS Astrogeology (HiRISE DTM/ortho, Fergason et al. 2020), ESA/DLR/FU Berlin HRSC
  via UDL Lyon, CRISM map by Saranathan/Parente/Itoh, THEMIS thermal inertia by Edwards & Buz,
  rover images NASA/JPL-Caltech (see each layer's citation in the app).

## Who owns what

| Area | Owner | Main files |
|---|---|---|
| UI | _TBD_ | `src/components/`, `src/App.tsx`, `src/styles.css` |
| Logic (safe-return engine) | _TBD_ | `src/engine/` |
| Data pipeline | _TBD_ | `data-pipeline/`, `public/data/` |
| Science mode (samples, targets) | _TBD_ | `points.json`, `SampleChecklist` |
| Pitch | _TBD_ | `docs/` |

## Changing things safely

- Tweak numbers in `src/engine/config.ts`, then `npm test`.
- Restyle via CSS variables at the top of `src/styles.css` (+ `src/theme.ts` for map colours).
- New data source? Implement `DataSource` in `src/data/source.ts`; the UI won't need changes.
