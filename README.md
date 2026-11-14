# Marswalk

Planning + live-navigation map for a 2-astronaut Mars EVA at the **Bright Angel** outcrop
(Jezero Crater, Neretva Vallis). The core feature is a **safe-return boundary**: the area
you can still walk back to the rover from, given remaining O2 and terrain slope. It shrinks
as the EVA goes on and turns yellow, then red.

> **All data is FAKE right now.** The terrain, point positions, O2 constants, and dust-devil
> forecast are placeholders. See "What's faked" below.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 (Vite default)
npm test         # unit tests (Vitest)
npm run lint
npm run build
npm run data:demo  # regenerate fake data (needs python3, no extra packages)
```

**Try it:** the app opens in **Plan** mode with a route to Cheyava Falls. Click the map to add
waypoints. Switch to **Navigate**, set speed to 10, press **Play**: astronauts walk, O2 drops,
the boundary shrinks and changes colour, and banners fire.

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
public/data/          points.json, slope.json (the app's inputs)
data-pipeline/        Python scripts: HiRISE -> public/data (stubbed, has --demo)
docs/CONTRACT.md      the data contract
```

## Data contract (short version)

- Local meters, `(0,0)` = rover, `x` east, `y` north.
- `points.json`: `[{ id, name, type: rover|target|sample|hazard, x, y, note? }]`
- `slope.json`: `{ width, height, cell_m, origin_x, origin_y, data }`, row 0 = north.
- `canReturn(state, grid) -> { maxDistance_m, boundaryPolygon, status, minutesToTurnback }`

Full version: [docs/CONTRACT.md](docs/CONTRACT.md).

## How the safe-return boundary works

1. Each step between neighbouring cells costs O2 = breathing for the time it takes
   (slower on slopes) + walking effort (harder on slopes). Slopes > 20 deg are walls.
2. Dijkstra from the rover gives the cheapest O2 cost from **every** cell back to the rover.
   This only depends on terrain, so it's computed once and cached.
3. Each tick: `budget = O2 left - 30 min reserve`. Cells with cost <= budget are inside;
   marching squares traces the edge into a polygon.
4. `margin = budget - cost home for the furthest astronaut`. < 20 min = warn, < 10 = turn back.

## What's faked

| Thing | Fake version | Real version |
|---|---|---|
| Slope grid | sine-wave plains + a N-S "channel wall" with 2 ramps + random steep blobs (`export_slope.py --demo`, seed 42) | HiRISE DTM -> `gdaldem slope` -> 5 m |
| Points | made-up positions (Cheyava Falls ~900 m west) | real coordinates via `make_points.py` |
| Basemap | slope-shaded rust colour drawn in the browser | HiRISE ortho PNG (`source.ts`) |
| O2 / speed constants | round placeholder numbers (`config.ts`) | from EVA physiology references |
| Dust devils | hard-coded "12:00-14:00" | forecast / climatology |
| O2 | one shared number for the team | per-suit telemetry |

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
