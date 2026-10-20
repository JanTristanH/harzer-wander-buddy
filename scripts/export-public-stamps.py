#!/usr/bin/env python3
"""Export a reproducible, public-only catalogue without starting CAP.

Only the regular HWN stamps valid at --as-of are exported. Never serialize an
entire CAP row: the demo CSV also contains user/group state.
"""

import argparse
import csv
from datetime import datetime
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("backend/hwb/db/doNotDeploy-data/hwb.db.Stampboxes.csv")


def timestamp(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Validity timestamps must include a timezone")
    return parsed


def catalogue(csv_path, as_of, revision):
    instant = timestamp(as_of + "T00:00:00Z")
    stamps = []
    numbers = set()
    with csv_path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            if not timestamp(row["validFrom"]) <= instant < timestamp(row["validTo"]):
                continue
            number = int(row["number"])
            if number not in range(1, 223) or number in numbers:
                raise ValueError(f"Unexpected/duplicate active HWN number: {number}")
            latitude, longitude = float(row["latitude"]), float(row["longitude"])
            # Fail on missing, NaN, swapped or implausible Harz coordinates.
            if not (50 < latitude < 53 and 9 < longitude < 13):
                raise ValueError(f"Invalid Harz coordinates for HWN {number}")
            if not row["name"].strip() or not row["ID"].strip():
                raise ValueError(f"Missing name/ID for HWN {number}")
            numbers.add(number)
            stamps.append({
                "id": row["ID"],
                "number": number,
                "name": row["name"].strip(),
                "description": row["description"].strip(),
                "latitude": latitude,
                "longitude": longitude,
                "validFrom": row["validFrom"],
                "validTo": row["validTo"],
            })
    if numbers != set(range(1, 223)):
        raise ValueError(f"Missing active HWN numbers: {sorted(set(range(1, 223)) - numbers)}")
    return {
        "schemaVersion": 1,
        "source": {
            "repository": "JanTristanH/harzer-wander-buddy",
            "revision": revision,
            "path": str(SOURCE),
            "sha256": hashlib.sha256(csv_path.read_bytes()).hexdigest(),
            "asOf": as_of,
        },
        "stamps": sorted(stamps, key=lambda stamp: stamp["number"]),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--as-of", required=True, help="Validity date, YYYY-MM-DD (UTC)")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    result = catalogue(ROOT / SOURCE, args.as_of, revision)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Exported {len(result['stamps'])} public stamps to {args.output}")


if __name__ == "__main__":
    main()
