#!/usr/bin/env python3
"""Convert a CSV of named points in projected meters to local-grid points.json.

CSV columns (header required):
  id,name,type,easting,northing,note,sample_kind
  (or lon,lat instead of easting,northing: converted with the Mars 2000 sphere,
   equirectangular lat_ts=0, the projection of the USGS Jezero HiRISE mosaics)
  - type: rover | target | sample | hazard
  - exactly one row should have type=rover; it becomes (0, 0)
  - note and sample_kind (spot | no-spot | blank) are optional

Example:
  python3 make_points.py points_example.csv --out ../public/data/points.json
"""
import argparse
import csv
import json
import math

MARS_R = 3396190.0


def projected(r):
    """(easting, northing) in meters from either easting/northing or lon/lat columns."""
    if r.get("easting"):
        return float(r["easting"]), float(r["northing"])
    return MARS_R * math.radians(float(r["lon"])), MARS_R * math.radians(float(r["lat"]))

VALID_TYPES = {"rover", "target", "sample", "hazard"}


def convert(rows, rover_e=None, rover_n=None):
    if rover_e is None or rover_n is None:
        rovers = [r for r in rows if r["type"] == "rover"]
        if len(rovers) != 1:
            raise SystemExit("Need exactly one rover row, or pass --rover-e/--rover-n")
        rover_e, rover_n = projected(rovers[0])

    out = []
    for r in rows:
        if r["type"] not in VALID_TYPES:
            raise SystemExit(f"Bad type {r['type']!r} for {r['id']}")
        p = {
            "id": r["id"],
            "name": r["name"],
            "type": r["type"],
            # Local grid = projected meters minus rover position (x east, y north).
            "x": round(projected(r)[0] - rover_e, 1),
            "y": round(projected(r)[1] - rover_n, 1),
        }
        if r.get("note"):
            p["note"] = r["note"]
        if r.get("sample_kind"):
            p["sample_kind"] = r["sample_kind"]
        out.append(p)
    return out


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("csv")
    p.add_argument("--rover-e", type=float)
    p.add_argument("--rover-n", type=float)
    p.add_argument("--out", default="../public/data/points.json")
    a = p.parse_args()

    with open(a.csv, newline="") as f:
        rows = list(csv.DictReader(f))
    points = convert(rows, a.rover_e, a.rover_n)
    with open(a.out, "w") as f:
        json.dump(points, f, indent=2)
    print(f"wrote {a.out}: {len(points)} points")


if __name__ == "__main__":
    main()
