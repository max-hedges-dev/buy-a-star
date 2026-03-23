import csv
import json
import os
import urllib.request


HYG_URL = "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv"
SCRIPT_DIR = os.path.dirname(__file__)
CSV_PATH = os.path.join(SCRIPT_DIR, "hygdata_v41.csv")
STARS_PATH = os.path.join(SCRIPT_DIR, "..", "app", "data", "stars.json")


def parse_int(value):
    if value in (None, ""):
        return None
    try:
        return int(value)
    except ValueError:
        return None


def parse_float(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def clean_string(value):
    value = (value or "").strip()
    return value or None


def sol_fields():
    return {
        "hyg_id": 0,
        "hip": 0,
        "hd": None,
        "hr": None,
        "gl": None,
        "bf": None,
        "bayer": None,
        "flamsteed": None,
        "constellation": None,
        "spectral_type": "G2V",
        "ra_hours": None,
        "dec_degrees": None,
        "distance_parsecs": 0.0,
        "apparent_magnitude": -26.74,
        "absolute_magnitude": 4.83,
        "luminosity": 1.0,
        "color_index": 0.656,
        "radial_velocity": None,
        "pmra": None,
        "pmdec": None,
        "variable_designation": None,
        "variable_min": None,
        "variable_max": None,
    }


def row_to_fields(row):
    return {
        "hyg_id": parse_int(row.get("id")),
        "hip": parse_int(row.get("hip")),
        "hd": parse_int(row.get("hd")),
        "hr": parse_int(row.get("hr")),
        "gl": clean_string(row.get("gl")),
        "bf": clean_string(row.get("bf")),
        "bayer": clean_string(row.get("bayer")),
        "flamsteed": parse_int(row.get("flam")),
        "constellation": clean_string(row.get("con")),
        "spectral_type": clean_string(row.get("spect")),
        "ra_hours": parse_float(row.get("ra")),
        "dec_degrees": parse_float(row.get("dec")),
        "distance_parsecs": parse_float(row.get("dist")),
        "apparent_magnitude": parse_float(row.get("mag")),
        "absolute_magnitude": parse_float(row.get("absmag")),
        "luminosity": parse_float(row.get("lum")),
        "color_index": parse_float(row.get("ci")),
        "radial_velocity": parse_float(row.get("rv")),
        "pmra": parse_float(row.get("pmra")),
        "pmdec": parse_float(row.get("pmdec")),
        "variable_designation": clean_string(row.get("var")),
        "variable_min": parse_float(row.get("var_min")),
        "variable_max": parse_float(row.get("var_max")),
    }


def ensure_hyg_csv():
    if os.path.exists(CSV_PATH):
        return
    print(f"Downloading HYG catalog from {HYG_URL} ...")
    urllib.request.urlretrieve(HYG_URL, CSV_PATH)


def build_lookup():
    with open(CSV_PATH, newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        return {
            row["hip"].strip(): row
            for row in reader
            if clean_string(row.get("hip"))
        }


def enrich_stars():
    ensure_hyg_csv()

    with open(STARS_PATH, "r", encoding="utf-8") as stars_file:
        stars = json.load(stars_file)

    by_hip = build_lookup()
    matched = 0

    for star in stars:
        star_id = str(star.get("id", "")).strip()
        if star_id == "0" or star.get("common_name") == "Sol":
            star.update(sol_fields())
            matched += 1
            continue

        row = by_hip.get(star_id)
        if not row:
            continue

        star.update(row_to_fields(row))
        matched += 1

    with open(STARS_PATH, "w", encoding="utf-8") as stars_file:
        json.dump(stars, stars_file, indent=2)

    print(f"Enriched {matched} / {len(stars)} stars in {STARS_PATH}")


if __name__ == "__main__":
    enrich_stars()
