# Marswalk data contract

Everyone (UI, logic, data pipeline) agrees on these shapes. TypeScript mirror: `src/types.ts`.
If you change something here, change it there too and tell the team.

## Coordinates

- Local grid in **meters**. Origin `(0, 0)` = rover parking spot.
- `x` = east, `y` = north.
- Leaflet uses `L.CRS.Simple`, so map `[lat, lng]` = `[y, x]`. The only place that flip
  happens is the `ll()` helper in `src/components/MapView.tsx`.

## `public/data/points.json`

```json
[{ "id": "cheyava", "name": "Cheyava Falls", "type": "target", "x": -900, "y": 50, "note": "optional" }]
```

| field | type | notes |
|---|---|---|
| `id` | string | unique |
| `name` | string | shown as map label |
| `type` | `"rover" \| "target" \| "sample" \| "hazard"` | exactly one `rover`, at (0,0) |
| `x`, `y` | number | local meters |
| `note` | string? | free text |
| `sample_kind` | `"spot" \| "no-spot" \| "blank"`? | **extension**, only for `type: "sample"` |

## `public/data/slope.json`

```json
{ "width": 600, "height": 600, "cell_m": 5, "origin_x": -1500, "origin_y": 1500, "data": [ ... ] }
```

- `data`: slope in **degrees**, row-major, length `width * height`.
- **Row 0 is the north edge** (same order a GeoTIFF is stored in).
- `origin_x`, `origin_y`: local coords of the grid's **north-west corner**.
- Centre of cell `(row r, col c)`: `x = origin_x + (c + 0.5) * cell_m`, `y = origin_y - (r + 0.5) * cell_m`.
- No-data pixels are written as `90` (impassable) by the pipeline.

## Sim state

```ts
{ astronauts: [{x, y}, {x, y}], rover: {x, y}, o2_min_left, elapsed_min, clock_local: "HH:MM" }
```

`o2_min_left` is in "minutes of O2 at rest" (resting burns 1 per minute).

## Safe-return

`canReturn(state, slopeGrid)` in `src/engine/safeReturn.ts` returns:

```ts
{
  maxDistance_m,        // farthest straight-line distance from the rover still inside the boundary
  boundaryPolygon,      // [x, y][] largest ring of the reachable area
  status,               // "ok" | "warn" | "turnback"
  minutesToTurnback,    // margin / resting burn rate (optimistic: assumes standing still)
  rings?,               // extension: all rings (outer + holes)
  margin_min?,          // extension: O2 left after the worst astronaut walks home, beyond reserve
}
```

- Boundary = cells whose O2 cost to walk back to the rover `<= o2_min_left - RESERVE_MIN`.
- `margin = (o2_min_left - RESERVE_MIN) - max(return cost of each astronaut)`.
- `status`: `warn` if margin < 20 min, `turnback` if margin < 10 min.
- All constants: `src/engine/config.ts`.
