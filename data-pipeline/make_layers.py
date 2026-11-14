#!/usr/bin/env python3
"""Build the extra map layers (natural colour, minerals, thermal inertia) on OUR grid.

Approach and sources ported from Mughani05's marswalk3d (scripts/prepare_terrain.py):
HRSC colour pan-sharpened with HiRISE, CRISM minerals, THEMIS thermal inertia.
(Their western-rim CRISM fallback map only covers 8% of our box, so we use the
landing-ellipse map, 80%, with the official key from its Jezero_readme.pdf.)
Changed for Marswalk: every layer is warped onto exactly the slope grid's box
(centred on the rover), so all layers line up with slope.json / elevation.json.

  python3 make_layers.py --rover-e <E> --rover-n <N>

Inputs (download once, see README): raw/UDL_HRSC-Mosaic_COLOR_Jezero.tif,
raw/jezeroFinal.tif, raw/Jezero_Thermal_Inertia_v1.tiff,
plus ortho_crop.tif from crop_remote.py.
Outputs: public/data/layers/*.jpg and public/data/layers.json.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import reproject

# Same projection as the USGS HiRISE mosaics (and therefore our grid).
EQC = CRS.from_proj4("+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs")
RAW = Path("raw")
HIRISE_CITE = "Fergason et al. 2020, Mars 2020 TRN HiRISE Orthorectified Image Mosaic, USGS, doi:10.5066/P9QJDP48"


def warp(path, box, size, band=1, resampling=Resampling.bilinear):
    """Reproject one band of any raster onto our box (eqc metres) at size x size px."""
    dst = np.zeros((size, size), dtype="float32")
    with rasterio.open(path) as src:
        nodata = src.nodata
        reproject(
            source=rasterio.band(src, band), destination=dst,
            dst_transform=from_bounds(*box, size, size), dst_crs=EQC,
            resampling=resampling, dst_nodata=np.nan,
        )
    if nodata is not None:
        dst[dst == nodata] = np.nan
    return dst


def stretch(a, lo_pct=2, hi_pct=98):
    v = a[np.isfinite(a)]
    lo, hi = np.percentile(v, [lo_pct, hi_pct])
    return np.clip((a - lo) / max(hi - lo, 1e-6), 0, 1)


def natural_colour(box, size, ortho):
    """HRSC colour (~50 m) for hue/saturation + HiRISE (2 m) for detail (their HSV trick)."""
    rgb = np.dstack([warp(RAW / "UDL_HRSC-Mosaic_COLOR_Jezero.tif", box, size, b) for b in (1, 2, 3)])
    rgb = np.nan_to_num(rgb).clip(0, 255).astype("uint8")
    gray = warp(ortho, box, size)
    gray = np.where(gray > 0, gray, np.nan)
    hsv = np.array(Image.fromarray(rgb, "RGB").convert("HSV"), dtype="float32")
    v_lo, v_hi = 35, 235  # spread HiRISE brightness wide; the HRSC range is too narrow (washed out)
    hsv[..., 2] = np.nan_to_num(stretch(gray) * (v_hi - v_lo) + v_lo, nan=v_lo)
    return np.array(Image.fromarray(hsv.clip(0, 255).astype("uint8"), "HSV").convert("RGB"))


# Official key from Jezero_readme.pdf (Parente, Itoh, Saranathan), p.5:
# (name, high-confidence RGB, medium-confidence RGB). Black (0,0,0) = no match.
CRISM_KEY = [
    ("Olivine", (255, 0, 0), (153, 0, 0)),
    ("Mg-carbonate", (0, 255, 0), (0, 153, 0)),
    ("Fe/Mg-smectite", (0, 255, 255), (0, 153, 153)),
    ("Olivine + smectite", (255, 128, 114), (153, 77, 68)),
    ("Olivine/smectite + 2.2 um", (128, 128, 0), (77, 77, 0)),
    ("Carbonate + 2.2 um", (255, 215, 0), (153, 129, 0)),
    ("High-Ca pyroxene", (255, 128, 0), (153, 77, 0)),
    ("Low-Ca pyroxene", (218, 165, 32), (130, 99, 19)),
    ("Kaolinite", (139, 69, 19), (83, 41, 11)),
    ("Mg-smectite 2", (0, 0, 255), (0, 0, 153)),
]


def minerals(box, size):
    """CRISM dominant-mineral map (Saranathan/Parente/Itoh) with its published key.

    Pixels are kept in their original colours (bright = high confidence,
    dull = medium); the legend counts both tones per mineral.
    """
    rgb = np.dstack([warp(RAW / "jezeroFinal.tif", box, size, b, Resampling.nearest) for b in (1, 2, 3)])
    rgb = np.nan_to_num(rgb).astype("int16")
    legend = []
    matched = np.zeros((size, size), dtype=bool)
    for name, hi, med in CRISM_KEY:
        m = np.zeros((size, size), dtype=bool)
        for code in (hi, med):
            m |= (np.abs(rgb - np.array(code)).sum(axis=-1) <= 6)  # small tolerance for JPEG-free exact codes
        matched |= m
        if m.mean() >= 0.001:
            legend.append({"color": "#%02x%02x%02x" % hi, "label": name, "percent": round(100 * float(m.mean()), 1)})
    out = rgb.clip(0, 255).astype("uint8")
    out[~matched] = (20, 20, 24)  # unmatched/no data = near black
    legend.sort(key=lambda L: -L["percent"])
    return out, legend, float(matched.mean())


def thermal(box, size):
    """THEMIS thermal inertia, low (dusty) -> high (rocky), their colour ramp."""
    ti = warp(RAW / "Jezero_Thermal_Inertia_v1.tiff", box, size)
    ti[(ti <= 0)] = np.nan
    lo, hi = float(np.nanmin(ti)), float(np.nanmax(ti))
    t = np.nan_to_num((ti - lo) / max(hi - lo, 1e-6), nan=0)
    stops = [(0.0, (26, 28, 34)), (0.35, (30, 92, 138)), (0.7, (120, 110, 78)), (1.0, (232, 220, 200))]
    rgb = np.zeros((size, size, 3), dtype="float32")
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        m = (t >= t0) & (t <= t1)
        u = ((t - t0) / (t1 - t0))[m][:, None]
        rgb[m] = np.array(c0) + u * (np.array(c1) - np.array(c0))
    stops_css = ["#%02x%02x%02x" % c for _, c in stops]
    return rgb.astype("uint8"), lo, hi, stops_css


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--rover-e", type=float, required=True)
    p.add_argument("--rover-n", type=float, required=True)
    p.add_argument("--slope", default="../public/data/slope.json")
    p.add_argument("--ortho", default="ortho_crop.tif")
    p.add_argument("--size", type=int, default=1450, help="output px (1450 = 2 m for our 2.9 km box)")
    p.add_argument("--out", default="../public/data")
    a = p.parse_args()

    g = json.load(open(a.slope))
    west, north = g["origin_x"] + a.rover_e, g["origin_y"] + a.rover_n
    box = (west, north - g["height"] * g["cell_m"], west + g["width"] * g["cell_m"], north)
    out = Path(a.out)
    (out / "layers").mkdir(parents=True, exist_ok=True)
    px = g["width"] * g["cell_m"] / a.size

    layers = [{
        "id": "hirise", "label": "HiRISE (grey)", "src": "/data/basemap.png",
        "resolution": f"{px:.0f} m/px", "citation": HIRISE_CITE,
    }]

    Image.fromarray(natural_colour(box, a.size, a.ortho)).save(out / "layers/colour.jpg", quality=85)
    layers.append({
        "id": "colour", "label": "Natural colour", "src": "/data/layers/colour.jpg",
        "resolution": f"{px:.0f} m/px detail, ~50 m colour",
        "citation": "HRSC colour mosaic of Jezero (ESA/DLR/FU Berlin; UDL Lyon mosaic), pan-sharpened with " + HIRISE_CITE,
        "note": "Colour comes from a ~50 m orbital mosaic: it shows broad tones, not individual rocks.",
    })

    rgb, legend, mapped = minerals(box, a.size)
    Image.fromarray(rgb).save(out / "layers/minerals.jpg", quality=90)
    layers.append({
        "id": "minerals", "label": "Minerals (CRISM)", "src": "/data/layers/minerals.jpg",
        "resolution": "~18 m/px (CRISM), stored at 36 m", "legend": legend,
        "citation": "Saranathan, Parente & Itoh, dominant mineralogy of the Mars 2020 landing ellipse (CRISM), doi:10.5281/zenodo.5575823",
        "note": f"{100 * mapped:.0f}% of this area matched a mineral. Bright = high confidence, dull = medium, black = no match. "
                "Names are closest-match prototypes, not confirmed identifications.",
    })

    rgb, lo, hi, stops = thermal(box, a.size)
    Image.fromarray(rgb).save(out / "layers/thermal.jpg", quality=90)
    layers.append({
        "id": "thermal", "label": "Thermal inertia", "src": "/data/layers/thermal.jpg",
        "resolution": "~100 m/px", "gradient": {"stops": stops, "min": round(lo), "max": round(hi), "units": "J m^-2 K^-1 s^-1/2"},
        "citation": "Edwards and Buz, THEMIS thermal inertia mosaic of Jezero, doi:10.5281/zenodo.4931347",
        "note": "High = rockier/bedrock (slow to cool), low = dusty or sandy. Useful hint for footing.",
    })

    json.dump(layers, open(out / "layers.json", "w"), indent=2)
    for L in layers:
        print(f"{L['id']:9s} {L['resolution']:28s} {L.get('note', '')}")
    print("legend:", legend)


if __name__ == "__main__":
    main()
