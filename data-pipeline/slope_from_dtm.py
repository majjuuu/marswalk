#!/usr/bin/env python3
"""DTM (elevation, m) -> slope (degrees) -> resampled to coarser cells.

Pure-numpy stand-in for:
  gdaldem slope dtm_crop.tif slope_1m.tif
  gdalwarp -tr 5 5 -r average slope_1m.tif slope_5m.tif

  python3 slope_from_dtm.py dtm_crop.tif --cell 5 --out slope_5m.tif

WHY slope first, then average (not the other way around): averaging elevation
first smooths away short steep steps, so the walls would look gentler than they are.
--agg max is the cautious option: a 5 m cell is as steep as its steepest 1 m pixel.
"""
import argparse

import numpy as np
import rasterio


def slope_degrees(z, px):
    """Horn's method (same as gdaldem): 3x3 weighted gradient."""
    p = np.pad(z, 1, mode="edge")
    a, b, c = p[:-2, :-2], p[:-2, 1:-1], p[:-2, 2:]
    d, f = p[1:-1, :-2], p[1:-1, 2:]
    g, h, i = p[2:, :-2], p[2:, 1:-1], p[2:, 2:]
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * px)
    dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * px)
    return np.degrees(np.arctan(np.hypot(dzdx, dzdy)))


def block_reduce(arr, k, how):
    h, w = (arr.shape[0] // k) * k, (arr.shape[1] // k) * k
    blocks = arr[:h, :w].reshape(h // k, k, w // k, k)
    return np.nanmax(blocks, axis=(1, 3)) if how == "max" else np.nanmean(blocks, axis=(1, 3))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("dtm")
    p.add_argument("--cell", type=float, default=5)
    p.add_argument("--agg", choices=["mean", "max"], default="mean")
    p.add_argument("--out", required=True)
    a = p.parse_args()

    with rasterio.open(a.dtm) as src:
        z = src.read(1, masked=True).astype("float64")
        px = src.res[0]
        prof = src.profile
        transform = src.transform

    zf = z.filled(np.nan)
    slope = slope_degrees(zf, px)  # NaN next to no-data, which is what we want
    k = int(round(a.cell / px))
    out = block_reduce(slope, k, a.agg).astype("float32")
    nodata = -9999.0
    out = np.where(np.isnan(out), nodata, out)

    prof.update(width=out.shape[1], height=out.shape[0], dtype="float32", nodata=nodata,
                transform=transform * rasterio.Affine.scale(k))
    with rasterio.open(a.out, "w", **prof) as dst:
        dst.write(out, 1)
    valid = out[out != nodata]
    print(f"wrote {a.out}: {out.shape[1]}x{out.shape[0]} @ {px * k} m, slope median {np.median(valid):.1f}, "
          f"p95 {np.percentile(valid, 95):.1f}, >20deg {100 * (valid > 20).mean():.1f}%")


if __name__ == "__main__":
    main()
