#!/usr/bin/env python3
"""
Generate a spatially balanced 5,000-star dataset from Gaia DR3.

The pipeline is intentionally curated for visualization rather than natural
near-Sun density. It:
1. pulls Gaia DR3 candidates with all required frontend fields,
2. derives galactic coordinates, cartesian coordinates, constellations,
3. stratifies candidates across radial / azimuth / latitude bins,
4. greedily enforces a minimum 3D separation,
5. writes a clean stars.json ready for the API/frontend,
6. writes diagnostics summarizing each filter stage.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import statistics
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from astropy import units as u
from astropy.coordinates import SkyCoord


SCRIPT_DIR = os.path.dirname(__file__)
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "..", "app", "data", "stars.json")
DIAGNOSTICS_PATH = os.path.join(SCRIPT_DIR, "..", "app", "data", "gaia_generation_diagnostics.json")
HYG_CSV_PATH = os.path.join(SCRIPT_DIR, "hygdata_v41.csv")

GAIA_ASYNC_URL = "https://gea.esac.esa.int/tap-server/tap/async"

DEFAULT_TARGET_COUNT = 5000
DEFAULT_TOP_PER_BIN = 2500
DEFAULT_DISTANCE_BINS_PC = [0, 200, 500, 1000, 2000, 4000, 7000, 10000, 15000, 22000, 32000]
DEFAULT_AZIMUTH_BINS = 18
DEFAULT_LATITUDE_BINS = 8
DEFAULT_MIN_STAR_PROB = 0.5
DEFAULT_MAX_DISTANCE_PC = 32000.0
DEFAULT_MIN_DISTANCE_PC = 1.0
FAMOUS_STAR_NAMES = [
    "Sol",
    "Sirius",
    "Betelgeuse",
    "Rigel",
    "Vega",
    "Polaris",
    "Canopus",
    "Arcturus",
    "Capella",
    "Procyon",
]

# Renderer mapping keeps the simulated galaxy looking broad and disc-like while
# preserving direction from the Sun and monotonic distance ordering.
GALAXY_RADIUS = 1500.0
BULGE_RADIUS_X = 250.0
REAL_GALAXY_RADIUS_LY = 50000.0
SUN_DIST_FROM_CENTER_LY = 26000.0
SPIN = 0.55
MODEL_SCALE = GALAXY_RADIUS / REAL_GALAXY_RADIUS_LY
MAX_MODEL_HEIGHT = 120.0

SOL_R = SUN_DIST_FROM_CENTER_LY * MODEL_SCALE
SOL_T = (SOL_R - BULGE_RADIUS_X) / (GALAXY_RADIUS - BULGE_RADIUS_X)
SOL_SPIRAL_ANGLE = SOL_T * SPIN * math.pi * 2
SOL_X = math.cos(SOL_SPIRAL_ANGLE) * SOL_R
SOL_Z = math.sin(SOL_SPIRAL_ANGLE) * SOL_R
SOL_DIR_TO_CENTER = math.atan2(-SOL_Z, -SOL_X)


@dataclass
class Candidate:
    canonical_id: str
    identifier_type: str
    source_catalog: str
    source_id: str
    display_name: str
    scientific_name: str
    category: str
    distance_pc: float
    distance_ly: float
    spectral_type: str
    apparent_mag: float
    absolute_mag: float
    luminosity_lsol: float
    color_index: float
    constellation: str
    ra_deg: float
    ra_hours: float
    dec_deg: float
    galactic_l_deg: float
    galactic_b_deg: float
    x_pc: float
    y_pc: float
    z_pc: float
    random_index: int
    star_probability: float
    price: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate stars.json from Gaia DR3.")
    parser.add_argument("--target-count", type=int, default=DEFAULT_TARGET_COUNT)
    parser.add_argument("--top-per-bin", type=int, default=DEFAULT_TOP_PER_BIN)
    parser.add_argument(
        "--distance-bins-pc",
        type=float,
        nargs="+",
        default=DEFAULT_DISTANCE_BINS_PC,
        help="Radial shell edges in parsecs for candidate fetching and balancing.",
    )
    parser.add_argument("--azimuth-bins", type=int, default=DEFAULT_AZIMUTH_BINS)
    parser.add_argument("--latitude-bins", type=int, default=DEFAULT_LATITUDE_BINS)
    parser.add_argument("--min-star-prob", type=float, default=DEFAULT_MIN_STAR_PROB)
    parser.add_argument("--max-distance-pc", type=float, default=DEFAULT_MAX_DISTANCE_PC)
    parser.add_argument("--min-distance-pc", type=float, default=DEFAULT_MIN_DISTANCE_PC)
    parser.add_argument("--query-timeout", type=int, default=600)
    return parser.parse_args()


def parse_float(value: Optional[str]) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_int(value: Optional[str]) -> Optional[int]:
    if value in (None, ""):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def valid_number(value: Optional[float]) -> bool:
    return value is not None and math.isfinite(value)


def absolute_mag_from_distance(apparent_mag: float, distance_pc: float) -> Optional[float]:
    if distance_pc <= 0:
        return None
    return apparent_mag - 5.0 * (math.log10(distance_pc) - 1.0)


def derive_star_class_label(spectral_type: str) -> str:
    spectral = (spectral_type or "").strip().upper()
    if not spectral:
        return "Yellow Dwarf"
    primary = spectral[0]
    if primary == "D":
        return "White Dwarf"
    if any(tag in spectral for tag in ("IA", "IAB", "IB")):
        size = "Supergiant"
    elif "III" in spectral or "II" in spectral:
        size = "Giant"
    elif "IV" in spectral:
        size = "Subgiant"
    else:
        size = "Dwarf"
    color_map = {
        "O": "Blue",
        "B": "Blue-White",
        "A": "White",
        "F": "Yellow-White",
        "G": "Yellow",
        "K": "Orange",
        "M": "Red",
        "C": "Red",
        "S": "Red",
        "L": "Red",
        "T": "Red",
        "Y": "Red",
        "W": "Blue",
    }
    color = color_map.get(primary, "Yellow")
    return f"{color} {size}"


def parse_identifier_from_hyg_row(row: Dict[str, str]) -> Tuple[Optional[str], Optional[str]]:
    for field, label in (("hip", "HIP"), ("hd", "HD"), ("hr", "HR"), ("gl", "GL"), ("bf", "BF")):
        raw = (row.get(field) or "").strip()
        if raw:
            return (raw if label == "BF" else f"{label} {raw}", label.lower() if label != "BF" else "bayer_flamsteed")
    return None, None


def heliocentric_galactic_xyz(distance_pc: float, l_deg: float, b_deg: float) -> Tuple[float, float, float]:
    l_rad = math.radians(l_deg)
    b_rad = math.radians(b_deg)
    cos_b = math.cos(b_rad)
    x_pc = distance_pc * cos_b * math.cos(l_rad)
    y_pc = distance_pc * cos_b * math.sin(l_rad)
    z_pc = distance_pc * math.sin(b_rad)
    return x_pc, y_pc, z_pc


def transformed_renderer_position(l_deg: float, b_deg: float, normalized_distance: float) -> Tuple[float, float, float]:
    if normalized_distance <= 0:
        return round(SOL_X, 4), 0.0, round(SOL_Z, 4)
    l_rad = math.radians(l_deg)
    b_rad = math.radians(b_deg)
    direction_angle = SOL_DIR_TO_CENTER + l_rad
    dx = math.cos(direction_angle)
    dz = math.sin(direction_angle)
    dot = SOL_X * dx + SOL_Z * dz
    c_term = (SOL_X * SOL_X + SOL_Z * SOL_Z) - (GALAXY_RADIUS * 0.985) ** 2
    discriminant = dot * dot - c_term
    max_offset = 0.0 if discriminant <= 0 else -dot + math.sqrt(discriminant)
    offset = max_offset * math.sqrt(normalized_distance)
    mx = SOL_X + dx * offset
    mz = SOL_Z + dz * offset
    vertical_band = min(MAX_MODEL_HEIGHT, 14.0 + offset * 0.12)
    my = math.sin(b_rad) * vertical_band
    return round(mx, 4), round(my, 4), round(mz, 4)


def constellation_name_from_hyg(value: Optional[str]) -> Optional[str]:
    abbr = (value or "").strip()
    return abbr or None


def percentile(values: Sequence[float], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * q
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1.0 - weight) + ordered[upper] * weight


def radial_bin_label(lo: float, hi: float) -> str:
    return f"{int(lo)}-{int(hi)} pc"


def tap_create_async_job(query: str, timeout: int) -> str:
    payload = urllib.parse.urlencode(
        {"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": query}
    ).encode()
    request = urllib.request.Request(GAIA_ASYNC_URL, data=payload, method="POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.geturl()


def tap_run_job(job_url: str, timeout: int) -> None:
    request = urllib.request.Request(
        f"{job_url}/phase",
        data=urllib.parse.urlencode({"PHASE": "RUN"}).encode(),
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout):
        return


def tap_wait_for_completion(job_url: str, timeout: int) -> None:
    start = time.time()
    while True:
        with urllib.request.urlopen(f"{job_url}/phase", timeout=timeout) as response:
            phase = response.read().decode().strip()
        if phase == "COMPLETED":
            return
        if phase in {"ERROR", "ABORTED"}:
            with urllib.request.urlopen(f"{job_url}/error", timeout=timeout) as response:
                detail = response.read().decode("utf-8", "ignore")
            raise RuntimeError(f"Gaia TAP job failed with phase {phase}: {detail}")
        if time.time() - start > timeout:
            raise TimeoutError(f"Timed out waiting for Gaia TAP job at {job_url}")
        time.sleep(2)


def tap_fetch_csv_rows(job_url: str, timeout: int) -> List[Dict[str, str]]:
    with urllib.request.urlopen(f"{job_url}/results/result", timeout=timeout) as response:
        payload = response.read().decode("utf-8", "ignore")
    return list(csv.DictReader(payload.splitlines()))


def gaia_candidate_query(distance_lo_pc: float, distance_hi_pc: float, top_per_bin: int, min_star_prob: float) -> str:
    return f"""
SELECT TOP {top_per_bin}
    gs.source_id,
    gs.ra,
    gs.dec,
    gs.phot_g_mean_mag,
    gs.bp_rp,
    gs.random_index,
    gs.classprob_dsc_combmod_star,
    ap.distance_gspphot,
    ap.mg_gspphot,
    ap.lum_flame,
    ap.spectraltype_esphs
FROM gaiadr3.gaia_source AS gs
JOIN gaiadr3.astrophysical_parameters AS ap USING (source_id)
WHERE gs.source_id IS NOT NULL
  AND gs.ra IS NOT NULL
  AND gs.dec IS NOT NULL
  AND gs.phot_g_mean_mag IS NOT NULL
  AND gs.bp_rp IS NOT NULL
  AND gs.random_index IS NOT NULL
  AND gs.classprob_dsc_combmod_star >= {min_star_prob}
  AND ap.distance_gspphot IS NOT NULL
  AND ap.distance_gspphot >= {distance_lo_pc}
  AND ap.distance_gspphot < {distance_hi_pc}
  AND ap.distance_gspphot > 0
  AND ap.mg_gspphot IS NOT NULL
  AND ap.lum_flame IS NOT NULL
  AND ap.lum_flame > 0
  AND ap.spectraltype_esphs IS NOT NULL
ORDER BY gs.random_index
""".strip()


def fetch_candidates_from_gaia(
    distance_bins_pc: Sequence[float],
    top_per_bin: int,
    min_star_prob: float,
    timeout: int,
) -> Tuple[List[Dict[str, str]], Dict[str, Dict[str, int]]]:
    raw_rows: List[Dict[str, str]] = []
    diagnostics: Dict[str, Dict[str, int]] = {}
    for lo, hi in zip(distance_bins_pc[:-1], distance_bins_pc[1:]):
        label = radial_bin_label(lo, hi)
        print(f"Fetching Gaia DR3 candidates for {label}...")
        query = gaia_candidate_query(lo, hi, top_per_bin, min_star_prob)
        job_url = tap_create_async_job(query, timeout)
        tap_run_job(job_url, timeout)
        tap_wait_for_completion(job_url, timeout)
        rows = tap_fetch_csv_rows(job_url, timeout)
        for row in rows:
            row["_query_bin"] = label
        raw_rows.extend(rows)
        diagnostics[label] = {"fetched": len(rows)}
        print(f"  fetched {len(rows)} rows")
    return raw_rows, diagnostics


def derive_constellation(ra_deg: float, dec_deg: float) -> str:
    coord = SkyCoord(ra=ra_deg * u.deg, dec=dec_deg * u.deg, frame="icrs")
    return coord.get_constellation(short_name=False)


def row_to_candidate(row: Dict[str, str], max_distance_pc: float, min_distance_pc: float) -> Optional[Candidate]:
    source_id = row.get("source_id")
    ra_deg = parse_float(row.get("ra"))
    dec_deg = parse_float(row.get("dec"))
    distance_pc = parse_float(row.get("distance_gspphot"))
    apparent_mag = parse_float(row.get("phot_g_mean_mag"))
    color_index = parse_float(row.get("bp_rp"))
    absolute_mag = parse_float(row.get("mg_gspphot"))
    luminosity_lsol = parse_float(row.get("lum_flame"))
    spectral_type = (row.get("spectraltype_esphs") or "").strip().replace('"', "")
    random_index = parse_int(row.get("random_index"))
    star_probability = parse_float(row.get("classprob_dsc_combmod_star"))
    required = [
        source_id,
        ra_deg,
        dec_deg,
        distance_pc,
        apparent_mag,
        color_index,
        absolute_mag,
        luminosity_lsol,
        spectral_type,
        random_index,
        star_probability,
    ]
    if any(value in (None, "") for value in required):
        return None
    if not all(valid_number(value) for value in (ra_deg, dec_deg, distance_pc, apparent_mag, color_index, absolute_mag, luminosity_lsol, star_probability)):
        return None
    if distance_pc <= min_distance_pc or distance_pc > max_distance_pc:
        return None
    if star_probability < DEFAULT_MIN_STAR_PROB:
        return None
    if not (-90.0 <= dec_deg <= 90.0 and 0.0 <= ra_deg <= 360.0):
        return None
    if not (-5.0 <= color_index <= 10.0):
        return None
    if not (-20.0 <= apparent_mag <= 30.0):
        return None
    if not valid_number(absolute_mag):
        absolute_mag = absolute_mag_from_distance(apparent_mag, distance_pc)
        if absolute_mag is None:
            return None
    coord = SkyCoord(ra=ra_deg * u.deg, dec=dec_deg * u.deg, distance=distance_pc * u.pc, frame="icrs")
    gal = coord.galactic
    galactic_l_deg = gal.l.degree
    galactic_b_deg = gal.b.degree
    x_pc, y_pc, z_pc = heliocentric_galactic_xyz(distance_pc, galactic_l_deg, galactic_b_deg)
    return Candidate(
        canonical_id=f"GAIA DR3 {source_id}",
        identifier_type="gaia_source_id",
        source_catalog="Gaia DR3",
        source_id=str(source_id),
        display_name=f"GAIA DR3 {source_id}",
        scientific_name=f"GAIA DR3 {source_id}",
        category=derive_star_class_label(spectral_type),
        distance_pc=distance_pc,
        distance_ly=distance_pc * 3.26156,
        spectral_type=spectral_type,
        apparent_mag=apparent_mag,
        absolute_mag=absolute_mag,
        luminosity_lsol=luminosity_lsol,
        color_index=color_index,
        constellation=derive_constellation(ra_deg, dec_deg),
        ra_deg=ra_deg,
        ra_hours=ra_deg / 15.0,
        dec_deg=dec_deg,
        galactic_l_deg=galactic_l_deg,
        galactic_b_deg=galactic_b_deg,
        x_pc=x_pc,
        y_pc=y_pc,
        z_pc=z_pc,
        random_index=int(random_index),
        star_probability=star_probability,
        price=12.99,
    )


def hyg_row_to_candidate(row: Dict[str, str]) -> Optional[Candidate]:
    canonical_id, identifier_type = parse_identifier_from_hyg_row(row)
    spectral_type = (row.get("spect") or "").strip()
    proper_name = (row.get("proper") or "").strip() or None
    ra_hours = parse_float(row.get("ra"))
    dec_deg = parse_float(row.get("dec"))
    distance_pc = parse_float(row.get("dist"))
    apparent_mag = parse_float(row.get("mag"))
    absolute_mag = parse_float(row.get("absmag"))
    luminosity_lsol = parse_float(row.get("lum"))
    color_index = parse_float(row.get("ci"))
    if not canonical_id or not identifier_type:
        return None
    if not all(
        valid_number(value)
        for value in (ra_hours, dec_deg, distance_pc, apparent_mag, absolute_mag, luminosity_lsol, color_index)
    ):
        return None
    if not spectral_type:
        return None

    ra_deg = ra_hours * 15.0
    coord = SkyCoord(ra=ra_deg * u.deg, dec=dec_deg * u.deg, distance=distance_pc * u.pc, frame="icrs")
    gal = coord.galactic
    galactic_l_deg = gal.l.degree
    galactic_b_deg = gal.b.degree
    x_pc, y_pc, z_pc = heliocentric_galactic_xyz(distance_pc, galactic_l_deg, galactic_b_deg)
    display_name = proper_name or canonical_id
    return Candidate(
        canonical_id=canonical_id,
        identifier_type=identifier_type,
        source_catalog="HYG v4.1",
        source_id=str(row.get("id") or canonical_id),
        display_name=display_name,
        scientific_name=display_name,
        category=derive_star_class_label(spectral_type),
        distance_pc=distance_pc,
        distance_ly=distance_pc * 3.26156,
        spectral_type=spectral_type,
        apparent_mag=apparent_mag,
        absolute_mag=absolute_mag,
        luminosity_lsol=luminosity_lsol,
        color_index=color_index,
        constellation=constellation_name_from_hyg(row.get("con")) or derive_constellation(ra_deg, dec_deg),
        ra_deg=ra_deg,
        ra_hours=ra_hours,
        dec_deg=dec_deg,
        galactic_l_deg=galactic_l_deg,
        galactic_b_deg=galactic_b_deg,
        x_pc=x_pc,
        y_pc=y_pc,
        z_pc=z_pc,
        random_index=10**9,
        star_probability=1.0,
        price=100.0 if proper_name else 12.99,
    )


def sol_candidate() -> Candidate:
    return Candidate(
        canonical_id="SOL",
        identifier_type="solar_system",
        source_catalog="Solar System",
        source_id="SOL",
        display_name="Sol",
        scientific_name="Sol",
        category="Yellow Dwarf",
        distance_pc=0.0,
        distance_ly=0.0,
        spectral_type="G2V",
        apparent_mag=-26.74,
        absolute_mag=4.83,
        luminosity_lsol=1.0,
        color_index=0.656,
        constellation="Sol",
        ra_deg=0.0,
        ra_hours=0.0,
        dec_deg=0.0,
        galactic_l_deg=0.0,
        galactic_b_deg=0.0,
        x_pc=0.0,
        y_pc=0.0,
        z_pc=0.0,
        random_index=-1,
        star_probability=1.0,
        price=100.0,
    )


def local_filter_candidates(raw_rows: Iterable[Dict[str, str]], max_distance_pc: float, min_distance_pc: float) -> Tuple[List[Candidate], Dict[str, int]]:
    diagnostics = {
        "rows_fetched": 0,
        "rows_with_required_fields": 0,
        "rows_surviving_local_quality_checks": 0,
        "duplicate_source_ids_removed": 0,
    }
    candidates: List[Candidate] = []
    seen_source_ids = set()
    for row in raw_rows:
        diagnostics["rows_fetched"] += 1
        candidate = row_to_candidate(row, max_distance_pc, min_distance_pc)
        if candidate is None:
            continue
        diagnostics["rows_with_required_fields"] += 1
        if candidate.source_id in seen_source_ids:
            diagnostics["duplicate_source_ids_removed"] += 1
            continue
        seen_source_ids.add(candidate.source_id)
        diagnostics["rows_surviving_local_quality_checks"] += 1
        candidates.append(candidate)
    return candidates, diagnostics


def load_famous_supplements() -> List[Candidate]:
    supplements = [sol_candidate()]
    needed = set(FAMOUS_STAR_NAMES) - {"Sol"}
    found = set()
    with open(HYG_CSV_PATH, "r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            proper = (row.get("proper") or "").strip()
            if proper not in needed or proper in found:
                continue
            candidate = hyg_row_to_candidate(row)
            if candidate is None:
                continue
            supplements.append(candidate)
            found.add(proper)
            if found == needed:
                break
    return supplements


def inject_famous_supplements(selected: List[Candidate], target_count: int) -> Tuple[List[Candidate], List[str]]:
    supplements = load_famous_supplements()
    selected_by_id = {candidate.canonical_id: candidate for candidate in selected}
    added_names = []
    for supplement in supplements:
        if supplement.canonical_id in selected_by_id:
            continue
        added_names.append(supplement.display_name)
        selected.append(supplement)
        selected_by_id[supplement.canonical_id] = supplement

    if not added_names:
        return selected[:target_count], []

    generic_candidates = [
        candidate for candidate in selected
        if candidate.source_catalog == "Gaia DR3" and candidate.display_name == candidate.canonical_id
    ]
    generic_candidates.sort(key=lambda item: (item.apparent_mag, item.distance_pc))
    remove_count = max(0, len(selected) - target_count)
    remove_ids = {candidate.canonical_id for candidate in generic_candidates[:remove_count]}
    trimmed = [candidate for candidate in selected if candidate.canonical_id not in remove_ids]
    return trimmed[:target_count], added_names


def assign_radial_bin(distance_pc: float, bin_edges: Sequence[float]) -> int:
    for index, (lo, hi) in enumerate(zip(bin_edges[:-1], bin_edges[1:])):
        if lo <= distance_pc < hi:
            return index
    return len(bin_edges) - 2


def compute_radial_quotas(candidates: Sequence[Candidate], bin_edges: Sequence[float], target_count: int) -> Dict[int, int]:
    by_bin: Dict[int, List[Candidate]] = defaultdict(list)
    for candidate in candidates:
        by_bin[assign_radial_bin(candidate.distance_pc, bin_edges)].append(candidate)
    remaining = target_count
    active_bins = {index for index, items in by_bin.items() if items}
    quotas = {index: 0 for index in range(len(bin_edges) - 1)}
    while active_bins and remaining > 0:
        share = max(1, remaining // len(active_bins))
        exhausted = set()
        for index in list(active_bins):
            available = len(by_bin[index]) - quotas[index]
            take = min(share, available)
            quotas[index] += take
            remaining -= take
            if quotas[index] >= len(by_bin[index]):
                exhausted.add(index)
            if remaining <= 0:
                break
        active_bins -= exhausted
        if share == 1 and not exhausted and remaining > 0:
            for index in list(active_bins):
                if remaining <= 0:
                    break
                available = len(by_bin[index]) - quotas[index]
                if available > 0:
                    quotas[index] += 1
                    remaining -= 1
    return quotas


def separation_grid_key(x_pc: float, y_pc: float, z_pc: float, cell_size: float) -> Tuple[int, int, int]:
    return (
        int(math.floor(x_pc / cell_size)),
        int(math.floor(y_pc / cell_size)),
        int(math.floor(z_pc / cell_size)),
    )


def candidate_is_far_enough(candidate: Candidate, grid: Dict[Tuple[int, int, int], List[Candidate]], min_separation_pc: float) -> bool:
    if min_separation_pc <= 0:
        return True
    gx, gy, gz = separation_grid_key(candidate.x_pc, candidate.y_pc, candidate.z_pc, min_separation_pc)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for other in grid.get((gx + dx, gy + dy, gz + dz), []):
                    dist = math.sqrt(
                        (candidate.x_pc - other.x_pc) ** 2
                        + (candidate.y_pc - other.y_pc) ** 2
                        + (candidate.z_pc - other.z_pc) ** 2
                    )
                    if dist < min_separation_pc:
                        return False
    return True


def build_shell_cells(candidates: Sequence[Candidate], azimuth_bins: int, latitude_bins: int) -> Dict[Tuple[int, int], List[Candidate]]:
    cells: Dict[Tuple[int, int], List[Candidate]] = defaultdict(list)
    for candidate in candidates:
        azimuth_index = min(azimuth_bins - 1, max(0, int((candidate.galactic_l_deg % 360.0) / 360.0 * azimuth_bins)))
        latitude_position = (math.sin(math.radians(candidate.galactic_b_deg)) + 1.0) * 0.5
        latitude_index = min(latitude_bins - 1, max(0, int(latitude_position * latitude_bins)))
        cells[(azimuth_index, latitude_index)].append(candidate)
    for key in cells:
        cells[key].sort(key=lambda item: (item.apparent_mag, item.random_index))
    return cells


def select_from_shell(
    candidates: Sequence[Candidate],
    quota: int,
    azimuth_bins: int,
    latitude_bins: int,
    selected_grid: Dict[Tuple[int, int, int], List[Candidate]],
    min_separation_pc: float,
) -> List[Candidate]:
    if quota <= 0:
        return []
    shell_cells = build_shell_cells(candidates, azimuth_bins, latitude_bins)
    ordered_keys = sorted(shell_cells.keys(), key=lambda key: (-len(shell_cells[key]), key))
    chosen: List[Candidate] = []
    while len(chosen) < quota and ordered_keys:
        next_keys: List[Tuple[int, int]] = []
        progress = False
        for key in ordered_keys:
            bucket = shell_cells[key]
            while bucket:
                candidate = bucket.pop(0)
                if candidate_is_far_enough(candidate, selected_grid, min_separation_pc):
                    chosen.append(candidate)
                    grid_key = separation_grid_key(candidate.x_pc, candidate.y_pc, candidate.z_pc, max(min_separation_pc, 1.0))
                    selected_grid[grid_key].append(candidate)
                    progress = True
                    break
            if bucket:
                next_keys.append(key)
            if len(chosen) >= quota:
                break
        if not progress:
            break
        ordered_keys = next_keys
    if len(chosen) < quota:
        leftovers = []
        for bucket in shell_cells.values():
            leftovers.extend(bucket)
        leftovers.sort(key=lambda item: (item.apparent_mag, item.random_index))
        for candidate in leftovers:
            if len(chosen) >= quota:
                break
            chosen.append(candidate)
            grid_key = separation_grid_key(candidate.x_pc, candidate.y_pc, candidate.z_pc, max(min_separation_pc, 1.0))
            selected_grid[grid_key].append(candidate)
    return chosen[:quota]


def select_balanced_sample(
    candidates: Sequence[Candidate],
    target_count: int,
    distance_bins_pc: Sequence[float],
    azimuth_bins: int,
    latitude_bins: int,
) -> Tuple[List[Candidate], Dict[str, object]]:
    quotas = compute_radial_quotas(candidates, distance_bins_pc, target_count)
    by_shell: Dict[int, List[Candidate]] = defaultdict(list)
    for candidate in candidates:
        by_shell[assign_radial_bin(candidate.distance_pc, distance_bins_pc)].append(candidate)
    x_values = [candidate.x_pc for candidate in candidates]
    y_values = [candidate.y_pc for candidate in candidates]
    z_values = [candidate.z_pc for candidate in candidates]
    volume = max(max(x_values) - min(x_values), 1.0) * max(max(y_values) - min(y_values), 1.0) * max(max(z_values) - min(z_values), 1.0)
    base_spacing = max(5.0, (volume / max(target_count, 1)) ** (1.0 / 3.0) * 0.18)
    selected: List[Candidate] = []
    shell_counts: Dict[str, int] = {}
    separation_attempts = []
    for factor in (1.0, 0.8, 0.6, 0.4, 0.25, 0.1, 0.0):
        selected = []
        selected_grid: Dict[Tuple[int, int, int], List[Candidate]] = defaultdict(list)
        shell_counts = {}
        min_separation_pc = base_spacing * factor
        separation_attempts.append(min_separation_pc)
        for shell_index in range(len(distance_bins_pc) - 1):
            quota = quotas.get(shell_index, 0)
            shell_candidates = list(by_shell.get(shell_index, []))
            if quota <= 0 or not shell_candidates:
                shell_counts[radial_bin_label(distance_bins_pc[shell_index], distance_bins_pc[shell_index + 1])] = 0
                continue
            chosen = select_from_shell(shell_candidates, quota, azimuth_bins, latitude_bins, selected_grid, min_separation_pc)
            selected.extend(chosen)
            shell_counts[radial_bin_label(distance_bins_pc[shell_index], distance_bins_pc[shell_index + 1])] = len(chosen)
        if len(selected) >= target_count:
            break

    if len(selected) < target_count:
        selected_by_id = {candidate.source_id: candidate for candidate in selected}
        for shell_index in range(len(distance_bins_pc) - 1):
            quota = quotas.get(shell_index, 0)
            current_label = radial_bin_label(distance_bins_pc[shell_index], distance_bins_pc[shell_index + 1])
            current_count = shell_counts.get(current_label, 0)
            if current_count >= quota:
                continue
            shell_candidates = list(by_shell.get(shell_index, []))
            shell_candidates.sort(key=lambda item: (item.apparent_mag, item.random_index))
            for candidate in shell_candidates:
                if current_count >= quota:
                    break
                if candidate.source_id in selected_by_id:
                    continue
                selected.append(candidate)
                selected_by_id[candidate.source_id] = candidate
                current_count += 1
            shell_counts[current_label] = current_count
    selected = selected[:target_count]
    return selected, {
        "radial_quotas": {radial_bin_label(distance_bins_pc[index], distance_bins_pc[index + 1]): quotas.get(index, 0) for index in range(len(distance_bins_pc) - 1)},
        "radial_selected_counts": shell_counts,
        "separation_attempts_pc": [round(value, 3) for value in separation_attempts],
        "selected_count": len(selected),
        "base_spacing_pc": round(base_spacing, 3),
    }


def nearest_neighbor_stats(candidates: Sequence[Candidate]) -> Dict[str, float]:
    if len(candidates) < 2:
        return {"min_pc": 0.0, "median_pc": 0.0, "p95_pc": 0.0, "max_pc": 0.0}
    nearest = []
    for index, candidate in enumerate(candidates):
        nearest_distance = None
        for other_index, other in enumerate(candidates):
            if index == other_index:
                continue
            dist = math.sqrt((candidate.x_pc - other.x_pc) ** 2 + (candidate.y_pc - other.y_pc) ** 2 + (candidate.z_pc - other.z_pc) ** 2)
            if nearest_distance is None or dist < nearest_distance:
                nearest_distance = dist
        nearest.append(nearest_distance or 0.0)
    return {
        "min_pc": round(min(nearest), 3),
        "median_pc": round(statistics.median(nearest), 3),
        "p95_pc": round(percentile(nearest, 0.95), 3),
        "max_pc": round(max(nearest), 3),
    }


def apply_renderer_positions(candidates: Sequence[Candidate]) -> List[Dict[str, object]]:
    ordered = sorted(candidates, key=lambda item: item.distance_pc)
    total = max(len(ordered) - 1, 1)
    positions = {}
    for index, candidate in enumerate(ordered):
        normalized = index / total
        positions[candidate.source_id] = transformed_renderer_position(candidate.galactic_l_deg, candidate.galactic_b_deg, normalized)
    output = []
    for candidate in candidates:
        x, y, z = positions[candidate.source_id]
        output.append({
            "id": candidate.canonical_id,
            "catalog_id": candidate.canonical_id,
            "canonical_id": candidate.canonical_id,
            "identifier_type": candidate.identifier_type,
            "source_catalog": candidate.source_catalog,
            "source_id": candidate.source_id,
            "display_name": candidate.display_name,
            "scientific_name": candidate.scientific_name,
            "common_name": None if candidate.source_catalog == "Gaia DR3" else candidate.display_name,
            "category": candidate.category,
            "distance_pc": round(candidate.distance_pc, 6),
            "distance_parsecs": round(candidate.distance_pc, 6),
            "distance_ly": round(candidate.distance_ly, 2),
            "spectral_type": candidate.spectral_type,
            "star_class_label": candidate.category,
            "apparent_mag": round(candidate.apparent_mag, 6),
            "apparent_magnitude": round(candidate.apparent_mag, 6),
            "absolute_mag": round(candidate.absolute_mag, 6),
            "absolute_magnitude": round(candidate.absolute_mag, 6),
            "luminosity_lsol": round(candidate.luminosity_lsol, 6),
            "luminosity": round(candidate.luminosity_lsol, 6),
            "color_index": round(candidate.color_index, 6),
            "constellation": candidate.constellation,
            "ra_deg": round(candidate.ra_deg, 6),
            "ra_degrees": round(candidate.ra_deg, 6),
            "ra_hours": round(candidate.ra_hours, 6),
            "dec_deg": round(candidate.dec_deg, 6),
            "dec_degrees": round(candidate.dec_deg, 6),
            "galactic_l_deg": round(candidate.galactic_l_deg, 6),
            "galactic_longitude_deg": round(candidate.galactic_l_deg, 6),
            "galactic_b_deg": round(candidate.galactic_b_deg, 6),
            "galactic_latitude_deg": round(candidate.galactic_b_deg, 6),
            "x_pc": round(candidate.x_pc, 6),
            "y_pc": round(candidate.y_pc, 6),
            "z_pc": round(candidate.z_pc, 6),
            "x": x,
            "y": y,
            "z": z,
            "price": candidate.price,
        })
    return output


def write_json(path: str, payload: object) -> None:
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def main() -> None:
    args = parse_args()
    if sorted(args.distance_bins_pc) != list(args.distance_bins_pc):
        raise ValueError("Distance bins must be sorted in ascending order.")
    raw_rows, query_diagnostics = fetch_candidates_from_gaia(args.distance_bins_pc, args.top_per_bin, args.min_star_prob, args.query_timeout)
    candidates, filter_diagnostics = local_filter_candidates(raw_rows, args.max_distance_pc, args.min_distance_pc)
    if len(candidates) < args.target_count:
        raise RuntimeError(f"Only {len(candidates)} valid Gaia candidates survived filtering, fewer than target {args.target_count}.")
    selected, sampling_diagnostics = select_balanced_sample(candidates, args.target_count, args.distance_bins_pc, args.azimuth_bins, args.latitude_bins)
    if len(selected) != args.target_count:
        raise RuntimeError(f"Expected exactly {args.target_count} selected stars, got {len(selected)}")
    selected, added_famous_names = inject_famous_supplements(selected, args.target_count)
    if len(selected) != args.target_count:
        raise RuntimeError(f"Expected exactly {args.target_count} selected stars after supplements, got {len(selected)}")
    output = apply_renderer_positions(selected)
    canonical_ids = [item["canonical_id"] for item in output]
    source_ids = [item["source_id"] for item in output]
    if len(set(canonical_ids)) != args.target_count:
        raise RuntimeError("Duplicate canonical_id values detected in final output.")
    if len(set(source_ids)) != args.target_count:
        raise RuntimeError("Duplicate source_id values detected in final output.")
    distance_pc_values = [item["distance_pc"] for item in output]
    distance_ly_values = [item["distance_ly"] for item in output]
    nn_stats = nearest_neighbor_stats(selected)
    radial_counts = defaultdict(int)
    for item in output:
        bin_index = assign_radial_bin(item["distance_pc"], args.distance_bins_pc)
        label = radial_bin_label(args.distance_bins_pc[bin_index], args.distance_bins_pc[bin_index + 1])
        radial_counts[label] += 1
    diagnostics = {
        "query_bins": query_diagnostics,
        "filtering": filter_diagnostics,
        "sampling": sampling_diagnostics,
        "final": {
            "count": len(output),
            "famous_supplements_added": added_famous_names,
            "distance_pc_min": round(min(distance_pc_values), 3),
            "distance_pc_max": round(max(distance_pc_values), 3),
            "distance_ly_min": round(min(distance_ly_values), 3),
            "distance_ly_max": round(max(distance_ly_values), 3),
            "nearest_neighbor_spacing_pc": nn_stats,
            "radial_bin_counts": dict(radial_counts),
        },
    }
    write_json(OUTPUT_PATH, output)
    write_json(DIAGNOSTICS_PATH, diagnostics)
    print(f"Fetched raw rows: {filter_diagnostics['rows_fetched']}")
    print(f"Rows with required fields: {filter_diagnostics['rows_with_required_fields']}")
    print(f"Rows surviving local quality checks: {filter_diagnostics['rows_surviving_local_quality_checks']}")
    print(f"Duplicate source IDs removed: {filter_diagnostics['duplicate_source_ids_removed']}")
    print(f"Final selected stars: {len(output)}")
    print(f"Distance range: {diagnostics['final']['distance_pc_min']} pc to {diagnostics['final']['distance_pc_max']} pc")
    print(f"Distance range: {diagnostics['final']['distance_ly_min']} ly to {diagnostics['final']['distance_ly_max']} ly")
    print(f"Nearest-neighbor spacing stats (pc): {nn_stats}")
    print(f"Count per radial bin: {dict(radial_counts)}")
    print(f"Famous supplements added: {added_famous_names}")
    print(f"Wrote {OUTPUT_PATH}")
    print(f"Wrote {DIAGNOSTICS_PATH}")


if __name__ == "__main__":
    main()
