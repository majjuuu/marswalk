#!/usr/bin/env python3
"""Sanity-check a slope raster against where Perseverance actually drove.

The rover's planners avoid steep ground, so if lots of its real path lands on
cells we call "impassable", our slope processing is too pessimistic (DTM noise
or a too-cautious resampling). It only works in that direction: the rover's
limits differ from an astronaut's, so a clean result doesn't prove we're right.

  python3 check_traverse.py M20_traverse.json slope_5m.tif slope_5m_max.tif

M20_traverse.json: https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json
"""
import argparse
import json
import math

import numpy as np
import rasterio

MARS_R = 3396190.0
STEP_M = 1.0  # sample the path every metre


def samples(traverse_path):
    """Yield (x, y) projected metres every STEP_M along every drive."""
    for f in json.load(open(traverse_path))["features"]:
        pts = [(MARS_R * math.radians(lon), MARS_R * math.radians(lat)) for lon, lat, *_ in f["geometry"]["coordinates"]]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = max(1, int(math.hypot(x1 - x0, y1 - y0) / STEP_M))
            for k in range(n):
                yield x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("traverse")
    p.add_argument("slopes", nargs="+")
    p.add_argument("--limit", type=float, default=20, help="impassable above this many degrees")
    a = p.parse_args()

    xy = np.array(list(samples(a.traverse)))
    for path in a.slopes:
        with rasterio.open(path) as src:
            arr = src.read(1)
            cols, rows = (~src.transform) * (xy[:, 0], xy[:, 1])
            rows, cols = np.floor(rows).astype(int), np.floor(cols).astype(int)
            inside = (rows >= 0) & (cols >= 0) & (rows < src.height) & (cols < src.width)
            s = arr[rows[inside], cols[inside]]
            s = s[s != src.nodata]
        print(f"{path}: {len(s) * STEP_M / 1000:.2f} km of traverse inside the raster")
        print(f"  slope along path: median {np.median(s):.1f}  p90 {np.percentile(s, 90):.1f}  p99 {np.percentile(s, 99):.1f}")
        for lim in (15, a.limit, 25, 30):
            print(f"  > {lim:>4.0f} deg: {100 * (s > lim).mean():5.1f}% of path")


if __name__ == "__main__":
    main()
