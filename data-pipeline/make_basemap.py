#!/usr/bin/env python3
"""Cut the ortho crop to exactly the slope grid's extent and save it as a PNG.

The app stretches basemap.png over the slope grid bounds, so the two MUST cover
the same box. We read the box straight from slope.json to guarantee that.

  python3 make_basemap.py ortho_crop.tif --slope ../public/data/slope.json \
      --rover-e <E> --rover-n <N> --out ../public/data/basemap.png
"""
import argparse
import json

import numpy as np
import rasterio
from rasterio.windows import from_bounds


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("ortho")
    p.add_argument("--slope", default="../public/data/slope.json")
    p.add_argument("--rover-e", type=float, required=True)
    p.add_argument("--rover-n", type=float, required=True)
    p.add_argument("--out", default="../public/data/basemap.png")
    a = p.parse_args()

    g = json.load(open(a.slope))
    # Local grid box -> projected meters (add the rover position back).
    west = g["origin_x"] + a.rover_e
    north = g["origin_y"] + a.rover_n
    east = west + g["width"] * g["cell_m"]
    south = north - g["height"] * g["cell_m"]

    with rasterio.open(a.ortho) as src:
        win = from_bounds(west, south, east, north, transform=src.transform)
        img = src.read(1, window=win, boundless=True, fill_value=0).astype("float32")

    # Stretch contrast using the 1st-99th percentile so the image isn't flat grey.
    valid = img[img > 0]
    lo, hi = np.percentile(valid, [1, 99])
    out = np.clip((img - lo) / (hi - lo) * 255, 0, 255).astype("uint8")

    with rasterio.open(a.out, "w", driver="PNG", width=out.shape[1], height=out.shape[0],
                       count=1, dtype="uint8") as dst:
        dst.write(out, 1)
    print(f"wrote {a.out}: {out.shape[1]}x{out.shape[0]} px")


if __name__ == "__main__":
    main()
