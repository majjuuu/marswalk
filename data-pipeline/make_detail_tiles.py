#!/usr/bin/env python3
"""High-resolution 3D tiles for the work area: 1 m terrain + 25 cm colour imagery.

The main grid (5 m terrain, 2 m image) is fine from above but blurry at eye
level. These tiles cover the area around the rover, the target and the samples
at the full resolution USGS publishes, and the 3D view swaps them in up close.

  python3 make_detail_tiles.py --rover-e <E> --rover-n <N>

Each tile is TILE_M x TILE_M metres:
  t_<row>_<col>.bin  (TILE_M+1)^2 int16 heights, decimetres relative to the rover,
                     row 0 = north, vertices 1 m apart, edges shared with neighbours
  t_<row>_<col>.jpg  TEX_PX x TEX_PX natural colour (HRSC colour + HiRISE 25 cm detail)
Index: public/data/detail/tiles.json
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.windows import Window, from_bounds

from make_layers import RAW, warp

ORTHO_URL = ("/vsicurl/https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/HiRISE/"
             "JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first.tif")
TILE_M = 512
TEX_PX = 2048  # 25 cm per pixel over 512 m
V_RANGE = (35, 235)  # output brightness for HiRISE's 2nd..98th percentile


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--rover-e", type=float, required=True)
    p.add_argument("--rover-n", type=float, required=True)
    p.add_argument("--points", default="../public/data/points.json")
    p.add_argument("--elevation", default="../public/data/elevation.json")
    p.add_argument("--dtm", default="dtm_crop.tif")
    p.add_argument("--margin", type=float, default=300, help="metres around the points to cover")
    p.add_argument("--out", default="../public/data/detail")
    a = p.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    rover_elev = json.load(open(a.elevation))["rover_elevation_m"]
    pts = json.load(open(a.points))
    # Work area in PROJECTED metres, snapped to whole metres so 1 m DTM pixels line up.
    west = math.floor(min(q["x"] for q in pts) - a.margin + a.rover_e)
    north = math.ceil(max(q["y"] for q in pts) + a.margin + a.rover_n)
    east = max(q["x"] for q in pts) + a.margin + a.rover_e
    south = min(q["y"] for q in pts) - a.margin + a.rover_n
    cols = math.ceil((east - west) / TILE_M)
    rows = math.ceil((north - south) / TILE_M)

    # One global contrast stretch for all tiles, so there are no seams between them.
    with rasterio.open("ortho_crop.tif") as s:
        g = s.read(1).astype("float32")
    g_lo, g_hi = np.percentile(g[g > 0], [2, 98])
    # Brightness comes from HiRISE, spread over most of the range. (Using the
    # colour mosaic's own narrow brightness range made everything washed out.)
    v_lo, v_hi = V_RANGE

    tiles = []
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GTIFF_DIRECT_IO="YES", GDAL_HTTP_MULTIRANGE="PARALLEL"):
        with rasterio.open(a.dtm) as dtm, rasterio.open(ORTHO_URL) as ortho:
            for r in range(rows):
                for c in range(cols):
                    # Vertices sit on DTM pixel centres: x0+0.5 ... x0+TILE_M+0.5 (shared edge).
                    x0 = west + c * TILE_M
                    y0 = north - r * TILE_M
                    win = from_bounds(x0, y0 - TILE_M - 1, x0 + TILE_M + 1, y0, transform=dtm.transform)
                    win = Window(round(win.col_off), round(win.row_off), TILE_M + 1, TILE_M + 1)
                    z = dtm.read(1, window=win, boundless=True, fill_value=np.nan).astype("float64")
                    z = np.where(np.abs(z) > 1e30, np.nan, z)
                    z = np.nan_to_num(z - rover_elev, nan=0.0)
                    dec = np.clip(np.round(z * 10), -32767, 32767).astype("<i2")  # decimetres
                    name = f"t_{r}_{c}"
                    dec.tofile(out / f"{name}.bin")

                    # Imagery over exactly the vertex span, at 25 cm.
                    box = (x0 + 0.5, y0 - TILE_M - 0.5, x0 + TILE_M + 0.5, y0 - 0.5)
                    ow = from_bounds(*box, transform=ortho.transform)
                    gray = ortho.read(1, window=ow, out_shape=(TEX_PX, TEX_PX)).astype("float32")
                    rgb = np.dstack([warp(RAW / "UDL_HRSC-Mosaic_COLOR_Jezero.tif", box, TEX_PX, b) for b in (1, 2, 3)])
                    hsv = np.array(Image.fromarray(np.nan_to_num(rgb).clip(0, 255).astype("uint8")).convert("HSV"), dtype="float32")
                    hsv[..., 2] = np.clip((gray - g_lo) / (g_hi - g_lo), 0, 1) * (v_hi - v_lo) + v_lo
                    img = Image.fromarray(hsv.clip(0, 255).astype("uint8"), "HSV").convert("RGB")
                    img.save(out / f"{name}.jpg", quality=80)

                    tiles.append({"id": name,
                                  # local metres of the north-west vertex
                                  "x0": round(x0 + 0.5 - a.rover_e, 3), "y0": round(y0 - 0.5 - a.rover_n, 3),
                                  "dem": f"/data/detail/{name}.bin", "tex": f"/data/detail/{name}.jpg"})
                    print(f"{name}: relief {z.min():.0f}..{z.max():.0f} m")

    index = {"size_m": TILE_M, "vertices": TILE_M + 1, "cell_m": 1, "height_unit_m": 0.1, "tex_px": TEX_PX,
             "citation": "USGS Mars 2020 TRN HiRISE DTM (1 m) and orthomosaic (25 cm), Fergason et al. 2020; "
                         "colour from HRSC (ESA/DLR/FU Berlin, UDL Lyon mosaic)",
             "tiles": tiles}
    json.dump(index, open(out / "tiles.json", "w"), indent=1)
    print(f"{len(tiles)} tiles ({cols}x{rows}) covering {cols * TILE_M} x {rows * TILE_M} m")


if __name__ == "__main__":
    main()
