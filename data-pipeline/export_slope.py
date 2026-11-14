#!/usr/bin/env python3
"""Write public/data/slope.json in the Marswalk contract format.

Two modes:
  --demo            Generate the deterministic FAKE grid (pure Python, no GDAL/numpy).
  --tif PATH        Read a real slope GeoTIFF (degrees) with rasterio and re-origin it
                    so (0, 0) is the rover parking spot.

Examples:
  python3 export_slope.py --demo --out ../public/data/slope.json
  python3 export_slope.py --tif slope_5m.tif --rover-e 4354012.5 --rover-n 1093221.0 \
      --out ../public/data/slope.json

Contract (see docs/CONTRACT.md):
  { width, height, cell_m, origin_x, origin_y, data }
  - data is row-major, row 0 = NORTH edge (same order a GeoTIFF is stored in)
  - origin_x/origin_y = local coords (m) of the grid's NORTH-WEST corner
"""
import argparse
import json
import math
import random

# Pixels with no data (holes in the DTM) become this slope, i.e. impassable.
# Safer to assume "can't walk there" than "flat".
NODATA_SLOPE_DEG = 90.0


# ---------------------------------------------------------------- demo grid
def demo_grid(seed=42, width=600, height=600, cell_m=5.0):
    """Fake terrain: gentle plains + a N-S channel wall with two ramps + steep patches."""
    rng = random.Random(seed)  # seeded => same file every run
    origin_x = -width * cell_m / 2   # grid centred on the rover
    origin_y = height * cell_m / 2

    # Gentle background undulation = a few random sine waves added together.
    waves = []
    for _ in range(5):
        ang = rng.uniform(0, 2 * math.pi)
        k = 2 * math.pi / rng.uniform(150, 700)  # wavelength 150-700 m
        waves.append((k * math.cos(ang), k * math.sin(ang), rng.uniform(0, 2 * math.pi)))

    # Random steep patches (boulder fields / crater rims). Keep them away from
    # the rover and the science target so the demo route stays sensible.
    patches = []
    while len(patches) < 7:
        cx, cy = rng.uniform(-1400, 1400), rng.uniform(-1400, 1400)
        if math.hypot(cx, cy) < 300 or math.hypot(cx + 900, cy) < 250:
            continue
        patches.append((cx, cy, rng.uniform(35, 80), rng.uniform(22, 32)))

    ramps_y = (-650.0, 720.0)  # where the channel wall is gentle enough to cross

    data = []
    for r in range(height):
        y = origin_y - (r + 0.5) * cell_m
        for c in range(width):
            x = origin_x + (c + 0.5) * cell_m

            # 1) background: map sum of waves (-5..5) to roughly 0-8 degrees
            s = sum(math.sin(kx * x + ky * y + ph) for kx, ky, ph in waves)
            slope = max(0.0, min(8.0, 4.0 + 0.8 * s))

            # 2) channel wall, wiggling north-south ~480 m west of the rover
            wall_x = -480 + 60 * math.sin(y / 400)
            d = abs(x - wall_x)
            on_ramp = any(abs(y - ry) < 60 for ry in ramps_y)
            if d < 35:
                wall = (10 + 5 * (1 - d / 35)) if on_ramp else (21 + 14 * (1 - d / 35))
                slope = max(slope, wall)
            elif d < 70:  # apron at the foot/top of the wall
                slope = max(slope, 8 + 8 * (1 - (d - 35) / 35))

            # 3) steep patches (Gaussian bumps)
            for cx, cy, sigma, peak in patches:
                dd = (x - cx) ** 2 + (y - cy) ** 2
                if dd < (3 * sigma) ** 2:
                    slope = max(slope, peak * math.exp(-dd / (2 * sigma * sigma)))

            data.append(round(slope, 1))

    return dict(width=width, height=height, cell_m=cell_m,
                origin_x=origin_x, origin_y=origin_y, data=data)


# ---------------------------------------------------------------- real grid
def grid_from_tif(path, rover_e, rover_n):
    # Imported lazily so --demo works without these installed.
    import numpy as np
    import rasterio

    with rasterio.open(path) as src:
        band = src.read(1, masked=True).astype("float64")
        t = src.transform
        if abs(t.a) != abs(t.e):
            raise SystemExit(f"Non-square pixels ({t.a} x {t.e}); gdalwarp -tr 5 5 first.")
        if t.b != 0 or t.d != 0:
            raise SystemExit("Rotated raster not supported; warp to north-up first.")
        arr = np.where(band.mask, NODATA_SLOPE_DEG, band.filled(0))
        arr = np.round(arr, 1)
        return dict(
            width=src.width,
            height=src.height,
            cell_m=float(t.a),
            # t.c / t.f = projected coords of the top-left (NW) corner.
            # Subtracting the rover position moves the origin onto the rover.
            origin_x=float(t.c - rover_e),
            origin_y=float(t.f - rover_n),
            data=arr.ravel().tolist(),  # numpy ravel is row-major, row 0 = north
        )


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--demo", action="store_true", help="write the fake grid")
    p.add_argument("--tif", help="slope GeoTIFF in degrees")
    p.add_argument("--rover-e", type=float, help="rover easting (same CRS as the tif)")
    p.add_argument("--rover-n", type=float, help="rover northing (same CRS as the tif)")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--out", default="../public/data/slope.json")
    a = p.parse_args()

    if a.demo:
        grid = demo_grid(seed=a.seed)
    elif a.tif:
        if a.rover_e is None or a.rover_n is None:
            p.error("--tif needs --rover-e and --rover-n")
        grid = grid_from_tif(a.tif, a.rover_e, a.rover_n)
    else:
        p.error("pass --demo or --tif")

    with open(a.out, "w") as f:
        json.dump(grid, f, separators=(",", ":"))
    print(f"wrote {a.out}: {grid['width']}x{grid['height']} @ {grid['cell_m']} m/cell")


if __name__ == "__main__":
    main()
