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

## Planned steps for real data

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
