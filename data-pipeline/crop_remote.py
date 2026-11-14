#!/usr/bin/env python3
"""Crop a window out of a big remote GeoTIFF without downloading the whole file.

Replaces `gdal_translate -projwin` for our case. GDAL's /vsicurl/ reads only the
byte ranges it needs over HTTP (the USGS Jezero mosaics are 1.8 GB / 7.4 GB).

Window is given around a lon/lat centre (Mars 2000 sphere, east-positive), so you
don't have to know the projected coordinates.

  python3 crop_remote.py --src dtm --lon 77.3052 --lat 18.4975 \
      --west 2000 --east 3000 --south 2000 --north 2000 --out dtm_crop.tif
  python3 crop_remote.py --src ortho --lon 77.3052 --lat 18.4975 ... --res 2 --out ortho_crop.tif

Needs: pip install rasterio numpy  (see README).
"""
import argparse
import math
import time

import rasterio
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

# USGS Astrogeology, Mars 2020 Terrain Relative Navigation HiRISE mosaics (public).
BASE = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/HiRISE/"
SOURCES = {
    "dtm": BASE + "JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif",
    "ortho": BASE + "JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first.tif",
}
MARS_R = 3396190.0  # sphere radius used by these products (equirectangular, lat_ts=0)


def lonlat_to_eqc(lon, lat):
    """Simple equirectangular: meters = radius * angle in radians."""
    return MARS_R * math.radians(lon), MARS_R * math.radians(lat)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--src", choices=SOURCES, required=True)
    p.add_argument("--lon", type=float, required=True)
    p.add_argument("--lat", type=float, required=True)
    for side in ("west", "east", "south", "north"):
        p.add_argument(f"--{side}", type=float, default=1500, help=f"meters {side} of centre")
    p.add_argument("--res", type=float, help="output pixel size in m (downsample, e.g. ortho -> 2)")
    p.add_argument("--resampling", choices=["average", "nearest"], default="average",
                   help="nearest reads far fewer rows from the server (faster), average looks smoother")
    p.add_argument("--out", required=True)
    a = p.parse_args()

    cx, cy = lonlat_to_eqc(a.lon, a.lat)
    bounds = (cx - a.west, cy - a.south, cx + a.east, cy + a.north)
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MULTIRANGE="YES"):
        with rasterio.open("/vsicurl/" + SOURCES[a.src]) as src:
            win = from_bounds(*bounds, transform=src.transform).round_offsets().round_lengths()
            scale = (a.res / src.res[0]) if a.res else 1
            shape = (int(win.height / scale), int(win.width / scale))
            t = time.time()
            data = src.read(1, window=win, out_shape=shape, resampling=Resampling[a.resampling])
            transform = src.window_transform(win) * rasterio.Affine.scale(scale)
            profile = src.profile | dict(width=shape[1], height=shape[0], transform=transform, driver="GTiff", compress="deflate", tiled=True)
            profile.pop("blockysize", None)
            with rasterio.open(a.out, "w", **profile) as dst:
                dst.write(data, 1)
    print(f"wrote {a.out}: {shape[1]}x{shape[0]} px in {time.time() - t:.0f}s, centre eqc=({cx:.1f}, {cy:.1f})")


if __name__ == "__main__":
    main()
