#!/usr/bin/env python3
"""Write public/data/elevation.json: the DTM on the SAME grid as slope.json.

Used by the 3D view to build the terrain mesh. Heights are metres RELATIVE TO
THE ROVER (rover ground = 0), so the 3D scene stays near the origin and small
numbers are easy to read.

  python3 export_elevation.py dtm_crop.tif --slope ../public/data/slope.json \
      --rover-e <E> --rover-n <N> --out ../public/data/elevation.json

Format: same fields as slope.json ({ width, height, cell_m, origin_x, origin_y, data }),
data = metres, row 0 = north.
"""
import argparse
import json
import math

import numpy as np
import rasterio
from rasterio.windows import from_bounds


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("dtm")
    p.add_argument("--slope", default="../public/data/slope.json", help="grid to match exactly")
    p.add_argument("--rover-e", type=float, required=True)
    p.add_argument("--rover-n", type=float, required=True)
    p.add_argument("--out", default="../public/data/elevation.json")
    a = p.parse_args()

    g = json.load(open(a.slope))
    W, H, cell = g["width"], g["height"], g["cell_m"]
    west, north = g["origin_x"] + a.rover_e, g["origin_y"] + a.rover_n
    east, south = west + W * cell, north - H * cell

    with rasterio.open(a.dtm) as src:
        k = int(round(cell / src.res[0]))  # DTM pixels per grid cell (5 for 1 m -> 5 m)
        win = from_bounds(west, south, east, north, transform=src.transform).round_offsets()
        z = src.read(1, window=rasterio.windows.Window(win.col_off, win.row_off, W * k, H * k), masked=True)
        z = z.astype("float64").filled(np.nan)

    # Block mean: each 5 m cell = average of its 5x5 one-metre pixels.
    z = np.nanmean(z.reshape(H, k, W, k), axis=(1, 3))
    # Make heights relative to the rover's cell, and fill any holes with that level.
    rr = int((g["origin_y"] - 0) // cell)
    rc = int((0 - g["origin_x"]) // cell)
    rover_elev = float(z[rr, rc])
    z = z - rover_elev
    z = np.where(np.isnan(z), 0.0, z)

    out = dict(width=W, height=H, cell_m=cell, origin_x=g["origin_x"], origin_y=g["origin_y"],
               # Geo-reference so the app can show lat/lon and true elevation (areoid).
               rover_lon=round(math.degrees(a.rover_e / 3396190.0), 6),
               rover_lat=round(math.degrees(a.rover_n / 3396190.0), 6),
               rover_elevation_m=round(rover_elev, 2),
               data=np.round(z, 1).ravel().tolist())
    with open(a.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {a.out}: {W}x{H}, relief {z.min():.0f}..{z.max():.0f} m relative to rover")


if __name__ == "__main__":
    main()
