#!/usr/bin/env python3
"""
Generate stars.json from the HYG stellar database.
Downloads ~120,000 real stars, selects 3000 well-separated ones,
and maps them to the galaxy model using galactic coordinates.
"""
import csv
import json
import math
import os
import random
import sys
import urllib.request

random.seed(42)  # reproducible results

# ── Galaxy model parameters (must match GalaxyGenerator.js) ──
GALAXY_RADIUS = 1500
ARMS = 4
SPIN = 0.55
BULGE_RADIUS_X = 250

# ── Real-world constants ──
REAL_GALAXY_RADIUS_LY = 50000
SUN_DIST_FROM_CENTER = 26000  # ly

# ── Model scale ──
MODEL_SCALE = GALAXY_RADIUS / REAL_GALAXY_RADIUS_LY  # 0.03 units/ly
SOL_R = SUN_DIST_FROM_CENTER * MODEL_SCALE  # ~780
SOL_T = (SOL_R - BULGE_RADIUS_X) / (GALAXY_RADIUS - BULGE_RADIUS_X)
SOL_SPIRAL_ANGLE = SOL_T * SPIN * math.pi * 2
SOL_X = math.cos(SOL_SPIRAL_ANGLE) * SOL_R
SOL_Z = math.sin(SOL_SPIRAL_ANGLE) * SOL_R
SOL_DIR_TO_CENTER = math.atan2(-SOL_Z, -SOL_X)

# ── Distance amplification ──
AMP_K = 40  # increased to push stars out to galaxy edges
RADIAL_SCATTER = 0.35  # ±35% random radial scatter to break arc patterns

# ── Target count ──
TARGET_STARS = 3000
GRID_CELL_SIZE = 45  # smaller cells for more stars

# ── HYG database ──
HYG_URL = "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv"

# ── Galactic coordinate conversion (J2000) ──
NGP_RA = math.radians(192.8594813)
NGP_DEC = math.radians(27.1282511)
GAL_LON_NCP = math.radians(122.9319185)

# ── Stars that MUST be included ──
MUST_INCLUDE = {
    "Sol", "Sirius", "Betelgeuse", "Rigel", "Vega", "Polaris",
    "Canopus", "Arcturus", "Capella", "Procyon", "Altair", "Deneb",
    "Antares", "Aldebaran", "Spica", "Regulus", "Fomalhaut",
    "Castor", "Pollux", "Bellatrix", "Algol", "Achernar",
}


def eq_to_galactic(ra_rad, dec_rad):
    """Convert J2000 equatorial to galactic (l, b) in radians."""
    sdec = math.sin(dec_rad)
    cdec = math.cos(dec_rad)
    sngp = math.sin(NGP_DEC)
    cngp = math.cos(NGP_DEC)
    dra = ra_rad - NGP_RA

    sin_b = sdec * sngp + cdec * cngp * math.cos(dra)
    b = math.asin(max(-1.0, min(1.0, sin_b)))
    cb = math.cos(b)

    if abs(cb) < 1e-10:
        l = 0.0
    else:
        sin_lm = cdec * math.sin(dra) / cb
        cos_lm = (sdec - sin_b * sngp) / (cb * cngp)
        l = (GAL_LON_NCP - math.atan2(sin_lm, cos_lm)) % (2 * math.pi)
    return l, b


def spectral_to_category(spect):
    """Map spectral type string to a readable star category."""
    if not spect or len(spect) < 1:
        return "Yellow Dwarf"

    sc = spect[0].upper()
    is_giant = False
    upper = spect.upper()
    for tag in ("IA", "IB", "II", "III", "IV"):
        if tag in upper:
            is_giant = True
            break
    if not is_giant and "V" in upper:
        is_giant = False

    size = "Giant" if is_giant else "Dwarf"
    color_map = {
        "W": "Blue", "O": "Blue", "B": "Blue-White",
        "A": "White" if is_giant else "Blue-White",
        "F": "White", "G": "Yellow", "K": "Orange", "M": "Red",
    }
    color = color_map.get(sc, "Yellow")
    return f"{color} {size}"


def star_model_position(l, b, dist_ly, is_must=False):
    """Compute model (mx, mz) for a star at galactic (l, b, dist_ly).
    Uses sqrt scaling with heavy radial + angular scatter to avoid arc patterns."""
    if dist_ly <= 0:
        return SOL_X, SOL_Z

    d_plane = dist_ly * math.cos(b)
    base_offset = math.sqrt(max(d_plane, 0.01)) * AMP_K

    # Heavy radial scatter to break ring/arc patterns
    if is_must:
        radial_scatter = 1.0 + (random.random() - 0.5) * 0.2  # ±10% for must-haves
    else:
        radial_scatter = 1.0 + (random.random() - 0.5) * 1.6  # ±80% for regular stars
    amplified = base_offset * radial_scatter

    # Angular scatter: ±15° for regular, ±3° for must-haves
    if is_must:
        angle_scatter = (random.random() - 0.5) * math.radians(6)
    else:
        angle_scatter = (random.random() - 0.5) * math.radians(30)

    # Direction in model: galactic l=0 → toward center from Sol
    model_angle = SOL_DIR_TO_CENTER + l + angle_scatter
    mx = SOL_X + amplified * math.cos(model_angle)
    mz = SOL_Z + amplified * math.sin(model_angle)

    # Additional small random offset to break any remaining structure
    if not is_must:
        mx += (random.random() - 0.5) * 150
        mz += (random.random() - 0.5) * 150

    return mx, mz


def soft_edge_filter(mx, mz):
    """Apply soft density falloff at galaxy edges.
    Returns (mx, mz, keep) where keep is whether the star should be included.
    Stars inside 70% radius: always kept
    Stars 70-100%: linearly decreasing probability
    Stars beyond 100%: dropped
    """
    r = math.sqrt(mx * mx + mz * mz)
    max_r = GALAXY_RADIUS * 1.05  # allow stars slightly beyond visual edge
    soft_start = GALAXY_RADIUS * 0.60  # start falloff at 60%

    if r > max_r:
        return mx, mz, False

    if r <= soft_start:
        return mx, mz, True

    # Linear falloff from 1.0 at soft_start to 0.15 at max_r
    t = (r - soft_start) / (max_r - soft_start)
    keep_prob = 1.0 - t * 0.85
    return mx, mz, random.random() < keep_prob


def get_spiral_arm_score(mx, mz):
    """Score how close a position is to a spiral arm. Higher = closer to arm."""
    r = math.sqrt(mx * mx + mz * mz)
    if r < BULGE_RADIUS_X * 0.5 or r > GALAXY_RADIUS:
        return 0.5  # neutral in bulge / outside

    angle = math.atan2(mz, mx)
    t = max(0, (r - BULGE_RADIUS_X) / (GALAXY_RADIUS - BULGE_RADIUS_X))

    best_dist = math.pi  # worst case
    for arm_i in range(ARMS):
        arm_offset = (arm_i / ARMS) * math.pi * 2
        arm_angle = arm_offset + t * SPIN * math.pi * 2
        # Angular distance
        diff = abs(((angle - arm_angle + math.pi) % (2 * math.pi)) - math.pi)
        if diff < best_dist:
            best_dist = diff

    # Score: 1.0 = on arm, 0.0 = between arms
    # Arms cover roughly ±0.3 radians
    score = max(0, 1.0 - best_dist / 0.5)
    return score


def grid_key(mx, mz):
    """Return grid cell key for spatial binning."""
    return (int(mx // GRID_CELL_SIZE), int(mz // GRID_CELL_SIZE))


def main():
    csv_path = os.path.join(os.path.dirname(__file__), "hygdata_v41.csv")

    # 1. Download HYG if needed
    if not os.path.exists(csv_path):
        print(f"Downloading HYG database from GitHub...")
        urllib.request.urlretrieve(HYG_URL, csv_path)
        print(f"Downloaded to {csv_path}")
    else:
        print(f"Using cached HYG database: {csv_path}")

    # 2. Parse all valid stars
    print("Parsing catalog...")
    all_stars = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                dist = float(row["dist"]) if row["dist"] else 0
            except (ValueError, KeyError):
                continue
            if dist <= 0 or dist > 100000:
                continue

            try:
                mag = float(row["mag"]) if row["mag"] else 99
            except ValueError:
                mag = 99
            if mag > 11:
                continue

            ra_rad = float(row.get("rarad", 0))
            dec_rad = float(row.get("decrad", 0))
            l, b = eq_to_galactic(ra_rad, dec_rad)
            dist_ly = dist * 3.26156

            proper = (row.get("proper") or "").strip()
            bf = (row.get("bf") or "").strip()
            hip = (row.get("hip") or "").strip()
            hd = (row.get("hd") or "").strip()
            spect = (row.get("spect") or "").strip()

            if bf:
                sci_name = bf
            elif hip:
                sci_name = f"HIP {hip}"
            elif hd:
                sci_name = f"HD {hd}"
            else:
                continue

            is_must = proper in MUST_INCLUDE
            mx, mz = star_model_position(l, b, dist_ly, is_must)
            mx, mz, keep = soft_edge_filter(mx, mz)
            if not keep and not is_must:
                continue

            all_stars.append({
                "scientific_name": sci_name,
                "common_name": proper or None,
                "category": spectral_to_category(spect),
                "l": l, "b": b,
                "dist_ly": round(dist_ly, 2),
                "mag": mag,
                "mx": mx, "mz": mz,
                "hip": hip,
                "is_must": is_must,
                "price": 100.0 if proper else 12.99,
            })

    # Add Sol manually
    all_stars.append({
        "scientific_name": "Sol",
        "common_name": "Sol",
        "category": "Yellow Dwarf",
        "l": 0, "b": 0,
        "dist_ly": 0,
        "mag": -26.74,
        "mx": SOL_X, "mz": SOL_Z,
        "hip": "0",
        "is_must": True,
        "price": 100.0,
    })

    print(f"Parsed {len(all_stars)} valid stars (mag < 11)")

    # 3. Compute spiral arm scores
    for s in all_stars:
        s["arm_score"] = get_spiral_arm_score(s["mx"], s["mz"])

    # 4. Select well-separated stars with spiral arm bias
    selected = []
    used_names = set()
    remaining = []
    for s in all_stars:
        if s["is_must"]:
            selected.append(s)
            used_names.add(s["scientific_name"])
        else:
            remaining.append(s)

    print(f"Must-include stars: {len(selected)}")

    # Sort by: arm_score * 0.3 (bonus for arm stars) - mag * 0.7 (brightness)
    # Higher score = better candidate
    # Stars on arms get selected first; among those, brighter ones win
    remaining.sort(key=lambda s: -(s["arm_score"] * 3.0 - s["mag"] * 0.7))

    # Grid-based selection: one star per cell, best-scoring wins
    occupied = set()
    for s in selected:
        occupied.add(grid_key(s["mx"], s["mz"]))

    for s in remaining:
        if len(selected) >= TARGET_STARS:
            break
        if s["scientific_name"] in used_names:
            continue
        key = grid_key(s["mx"], s["mz"])
        if key not in occupied:
            occupied.add(key)
            used_names.add(s["scientific_name"])
            selected.append(s)

    # Fill remaining with minimum-distance check
    if len(selected) < TARGET_STARS:
        MIN_DIST = 12
        for s in remaining:
            if len(selected) >= TARGET_STARS:
                break
            if s in selected or s["scientific_name"] in used_names:
                continue
            too_close = False
            for sel in selected[-200:]:  # check recent for speed
                dx = s["mx"] - sel["mx"]
                dz = s["mz"] - sel["mz"]
                if dx * dx + dz * dz < MIN_DIST * MIN_DIST:
                    too_close = True
                    break
            if not too_close:
                used_names.add(s["scientific_name"])
                selected.append(s)

    # Count arm vs inter-arm
    arm_count = sum(1 for s in selected if s["arm_score"] > 0.3)
    print(f"Selected {len(selected)} stars ({arm_count} near spiral arms)")

    # 5. Generate final JSON
    random.seed(42)
    output = []
    for i, s in enumerate(selected):
        dist_from_center = math.sqrt(s["mx"] ** 2 + s["mz"] ** 2)
        t_radial = min(1.0, dist_from_center / GALAXY_RADIUS)
        max_height = 50 * (1 - t_radial * 0.7)
        my = 0.0 if s["common_name"] == "Sol" else (random.random() - 0.5) * max_height

        output.append({
            "scientific_name": s["scientific_name"],
            "common_name": s["common_name"],
            "category": s["category"],
            "x": round(s["mx"], 4),
            "y": round(my, 4),
            "z": round(s["mz"], 4),
            "distance_ly": s["dist_ly"],
            "price": s["price"],
            "id": s["hip"] or str(i),
        })

    json_path = os.path.join(os.path.dirname(__file__), "..", "app", "data", "stars.json")
    with open(json_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {len(output)} stars to {json_path}")

    named = [s for s in output if s["common_name"]]
    print(f"Named stars: {len(named)}")
    print(f"\nSample must-have positions:")
    for s in output:
        if s["common_name"] in MUST_INCLUDE:
            print(f"  {s['common_name']:20s} -> ({s['x']:8.1f}, {s['y']:6.1f}, {s['z']:8.1f})  dist={s['distance_ly']:.1f} ly")


if __name__ == "__main__":
    main()
