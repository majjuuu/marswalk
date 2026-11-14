# Data pipeline

Turns HiRISE products into the two files the app reads (`public/data/slope.json`,
`public/data/points.json`). Format: see `../docs/CONTRACT.md`.

## Right now (fake data, no GDAL needed)

```bash
python3 export_slope.py --demo --out ../public/data/slope.json
python3 make_points.py points_example.csv --out ../public/data/points.json
# or from the repo root: npm run data:demo
```

`--demo` is pure Python stdlib. Real mode needs `pip install numpy rasterio`.

## What we actually ran (real Jezero data, no GDAL CLI needed)

```bash
python3 -m venv .venv && .venv/bin/pip install rasterio numpy
PY=.venv/bin/python
# 1) read just a 5 x 4 km window from the 1.8 GB / 7.4 GB USGS files over HTTP (~2 + 5 min)
$PY crop_remote.py --src dtm   --lon 77.30519 --lat 18.49748 --west 2000 --east 3000 --south 2000 --north 2000 --out dtm_crop.tif
$PY crop_remote.py --src ortho --lon 77.30519 --lat 18.49748 --west 2000 --east 3000 --south 2000 --north 2000 --res 2 --resampling nearest --out ortho_crop.tif
# 2) slope (gdaldem-style Horn method) then average to 5 m
$PY slope_from_dtm.py dtm_crop.tif --cell 5 --out slope_5m.tif
# 3) export around the rover (lon 77.32059, lat 18.48854 -> projected meters)
RE=$(python3 -c "import math;print(3396190*math.radians(77.32059))")
RN=$(python3 -c "import math;print(3396190*math.radians(18.48854))")
$PY export_slope.py --tif slope_5m.tif --rover-e $RE --rover-n $RN --half-size 1450 --out ../public/data/slope.json
$PY make_points.py points_jezero.csv --out ../public/data/points.json
$PY make_basemap.py ortho_crop.tif --rover-e $RE --rover-n $RN --out ../public/data/basemap.png
```

Sources: USGS Astrogeology Mars 2020 TRN HiRISE mosaics
(`asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/HiRISE/`, also listed in
NASA Mars Trek as "MRO HiRISE, Jezero DEM/Mosaic, Controlled"). Cheyava Falls position from
the Perseverance waypoints file (`mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json`).

## Check: does our slope agree with where Perseverance drove?

```bash
curl -sSLO https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json
$PY slope_from_dtm.py dtm_crop.tif --cell 5 --agg max --out slope_5m_max.tif
$PY check_traverse.py M20_traverse.json slope_5m.tif slope_5m_max.tif
```

Result (12.4 km of real traverse inside our 5 x 4 km crop):

| 5 m resampling | path median | path p99 | path > 20 deg | all terrain > 20 deg |
|---|---|---|---|---|
| mean (used) | 7.0 | 18.7 | **0.3%** | 10.3% |
| max | 10.0 | 22.8 | **4.4%** | 22.0% |

Rover planners steer around steep ground, so a path that drove through "impassable"
cells means false walls. `max` puts 1 in 23 metres of a real drive on a wall, which is
mostly 1 m DTM noise; `mean` agrees with the drive. We use `mean`. Caveat: averaging can hide
a single short ledge, and the rover's limits aren't an astronaut's, so this only shows
`max` is too strict, not that `mean` is exactly right.

## Original plan (GDAL CLI version)

1. **Get the products.** HiRISE DTM + orthoimage covering Bright Angel / Neretva Vallis
   (Jezero). Note the projection (equirectangular, meters).
2. **Crop** to a ~3 x 3 km box around the rover parking spot:
   ```bash
   gdal_translate -projwin <ulx> <uly> <lrx> <lry> DTM.IMG dtm_crop.tif
   gdal_translate -projwin <ulx> <uly> <lrx> <lry> ORTHO.JP2 ortho_crop.tif
   ```
3. **Slope** in degrees from the DTM (DTM ~1 m/px):
   ```bash
   gdaldem slope dtm_crop.tif slope_1m.tif
   ```
4. **Resample** to 5 m cells. `average` keeps a fair picture of each 5 m cell
   (`max` would be the more cautious choice; worth discussing with the science lead):
   ```bash
   gdalwarp -tr 5 5 -r average slope_1m.tif slope_5m.tif
   ```
5. **Export** to the contract, shifting the origin onto the rover:
   ```bash
   python3 export_slope.py --tif slope_5m.tif --rover-e <easting> --rover-n <northing> \
       --out ../public/data/slope.json
   ```
6. **Points**: fill a CSV like `points_example.csv` with real projected coordinates, then
   `python3 make_points.py my_points.csv`.
7. **Basemap**: export the cropped ortho to PNG covering exactly the slope grid's extent,
   save as `public/data/basemap.png`, and set `basemap.url` in `src/data/source.ts`.
8. Run `npm test`: `src/engine/data.test.ts` sanity-checks whatever is in `public/data`.
