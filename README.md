# MarsWalk — standalone Bright Angel HUD branch

A standalone React + TypeScript + Vite HUD prototype. **The scene now renders measured USGS HiRISE terrain and orbital imagery around Bright Angel.** Camera locations, science marker bearings, local rover-stop coordinates, the mineral/layer diagrams remain illustrative. The terrain texture is grayscale orbital imagery with a warm display tint, not surface photography or true color.

## Run it on your computer

Prerequisites: Node.js 20.19+ or 22.12+ and npm.

```bash
# Open terminal inside this folder
npm install
npm run dev
```

Open the `http://localhost:5173/` URL printed in the terminal. You may need another port if 5173 is busy.

## Production check

```bash
npm run build
npm run preview
```

Build output is in `dist/`.

## Try it

- Enter the terrain to start mouse look. Pointer lock starts automatically when an active browser user gesture permits it; otherwise a click is required. Browsers always reserve Esc to release pointer lock.
- Aim the center reticle at any ground point and click to move there. The camera stays 18 m above the terrain. Scroll to zoom.
- Aim at a named geographic marker and click to inspect it. M opens missions; E closes panels without releasing mouse look. Scroll to read the science panel.
- The HiRISE minimap shows the camera position and coordinates. Named locations are also available as map buttons when the cursor is released.
- Objectives complete automatically on visiting Bright Angel and opening each science inspection.
- Click turquoise navigation arrows in the scene, or the buttons at the bottom, to jump between three **illustrative** Bright Angel viewpoints.
- Watch the minimap dot and heading cone update. Tap another **connected** minimap stop to navigate.
- Click the science hotspot at the central scene to open the Cheyava Falls mineral panel.
- Jump to the layered outcrop stop, click its science hotspot, and read the sedimentary science panel.
- Open science markers to complete observations automatically; press M or click **Missions** to see the checklist.
- Switch camera / PIXL / SHERLOC information tabs. Only the camera view is rendered; other modes present contextual descriptions, not fabricated instrument measurements.

## Branch setup

If your repo is already cloned and has `main`, create an isolated branch:

```bash
cd YOUR_EXISTING_REPO
# Commit or stash any uncommitted work first.
git switch main
git switch -c hud
```

Extract these files into the repository root, then:

```bash
npm install
npm run dev
# After verifying everything:
git add .
git commit -m "Add standalone Bright Angel HUD prototype"
git push -u origin hud
```

If the repository's `main` or `3d-map` branch has its own `package.json`, avoid copying the HUD files over it until you have chosen how to merge them. The `hud` branch intentionally includes its own independent app scaffolding. If the branch already exists, use `git switch hud` instead.

## Structure

```
public/panoramas/               Synthetic 2:1 SVG demos; replace with calibrated panoramas
public/map/                     Synthetic maps and scientific diagrams
src/components/PanoramaViewer   Pointer-locked scene, arrows, science markers
src/components/BrightAngelTerrain Measured elevation mesh and orbital texture
public/terrain/                Browser-ready USGS terrain assets and provenance
scripts/prepare-terrain.py      Reproducible remote raster crop
src/components/RoverMiniMap     Standalone SVG image minimap, live heading cone
src/components/SciencePanel     Mineral and mudstone content; linked NASA science
src/components/InstrumentSelector
src/components/MissionChecklist
src/data/stops.ts               Demo node graph, hotspots and mission objectives
src/lib/angles.ts               Camera yaw, hotspot geometry, local bearing helpers
src/store.ts                    Shared Zustand HUD state
src/App.tsx                     Complete standalone responsive HUD UI
```

## Terrain source and regeneration

The scene uses a 1,024 × 1,024 m crop centered at 77.30519° E, 18.49748° N, around Cheyava Falls / Bright Angel. The USGS Mars 2020 TRN HiRISE 1 m DTM is resampled into a 257 × 257 mesh; the matching 25 cm orthomosaic is resampled to a 2,048 × 2,048 WebP texture. Elevation is in meters without vertical exaggeration. No procedural mountains or fabricated rock details are added. At this mesh resolution, small rocks and sedimentary textures are not resolved.

Source: [USGS Mars 2020 TRN HiRISE DTM mosaic](https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_hirise_dtm_mosaic), DOI [10.5066/P9REJ9JN](https://doi.org/10.5066/P9REJ9JN). Exact raster URLs and crop bounds are recorded in `public/terrain/`. The crop uses the source Mars sphere (radius 3,396,190 m) and equirectangular projection. Camera offsets and hotspot bearings are illustrative; they are not calibrated rover poses. The minimap uses the same HiRISE crop and projected coordinates as the terrain. Named viewpoint positions remain illustrative.

To regenerate assets (network access required):

```bash
python3 -m venv /tmp/marswalk-geo
/tmp/marswalk-geo/bin/pip install rasterio pillow
/tmp/marswalk-geo/bin/python scripts/prepare-terrain.py
```

The script checks geographic coverage and rejects missing pixels. It reads HTTP byte ranges rather than downloading the multi-gigabyte source mosaics. The bundled assets work without runtime requests to USGS.

## Replace placeholders with NASA data

1. Acquire a usable Bright Angel **Mastcam-Z 360 panorama**: https://science.nasa.gov/photojournal/perseverance-captures-bright-angel-in-360-degrees/ . Published versions can be cylindrical panoramas and may need re-projection to 2:1 equirectangular, with unmapped regions masked. Do not stretch a cropped panorama blindly across an entire sphere.
2. Replace the `public/panoramas/*.svg` files with optimized WebP/JPEG panoramas or tiled viewers. Update `image` fields in `src/data/stops.ts`.
3. Find **verified rover image locations, camera heading/pose, and sol** in NASA/PDS mission image and geometry metadata. Replace `x/y`, `headingOffsetDeg`, `sol` and `camera` in `stops.ts`. For actual Mars coordinates, implement a single georeferenced transform shared with the 3D map branch.
4. Only add a neighbor edge where travel between photographed observations is plausible and both stops are within the verified Bright Angel polygon. Here, graph neighbors and positions are synthetic.
5. Replace the minimap `public/map/bright-angel-map.svg` with georeferenced HiRISE orthoimagery (cropped to the Bright Angel region). Convert Mars map coordinates into image-local coordinates consistently. `RoverMiniMap.tsx` uses a **demo-only** affine layout.
6. Validate location and angular positions for science hotspots from the real imagery. A PIXL mineral map should be shown in a close-up scientific panel, not claimed to be resolved in the wide 360 panorama.
7. Replace demo mineral/layer diagrams with source-attributed NASA images and scientific evidence. Keep observed facts distinct from hypotheses about biological origin.

### Useful source links

- [NASA Bright Angel panorama](https://science.nasa.gov/photojournal/perseverance-captures-bright-angel-in-360-degrees/)
- [NASA PIXL vivianite/greigite mineral map](https://science.nasa.gov/photojournal/perseverances-pixl-finds-vivianite-greigite-in-cheyava-falls-sample/)
- [NASA Mars 2020 raw image archive](https://mars.nasa.gov/mars2020/multimedia/raw-images/index.cfm)
- [USGS HiRISE terrain DTM mosaic](https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_hirise_dtm_mosaic)

## Merge with the 3D map branch later

Keep HUD code under `src/components/` and state in `src/store.ts`, then reconcile the branch layout when merging. A shared API should expose `currentStopId`, `setCurrentStopId`, verified local meters / geographic coordinates, and the same terrain projection conversion. The existing demo stop positions are *not* safe to use as world coordinates.

## Notes

- This is an educational science interface, not a navigation system for operational EVA.
- Planetary coordinates and traversability require verified source data and model assumptions.
- No backend is required for this prototype. Mission progress is in-memory and resets on reload.
- The browser fetches Google Fonts if available; system fonts provide an offline fallback.
