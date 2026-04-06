from __future__ import annotations

import csv
import math
import re
import time
import http.cookiejar
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Optional

from astropy import units as u
from astropy.coordinates import SkyCoord


GAIA_ASYNC_URL = "https://gea.esac.esa.int/tap-server/tap/async"
DEFAULT_GAIA_TIMEOUT_SECONDS = 600
DEFAULT_MAX_DISTANCE_PC = 32000.0
DEFAULT_VALUATION_DISTANCE_BINS_PC = [0, 200, 500, 1000, 2000, 4000, 7000, 10000, 15000, 22000, 32000]
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

REQUIRED_PRICING_METRICS = (
    "phot_g_mean_mag",
    "parallax",
    "lum_flame",
    "teff_gspphot",
    "mh_gspphot",
    "non_single_star",
    "phot_variable_flag",
    "best_class_name",
    "radius_flame",
    "age_flame",
)


@dataclass
class GaiaValuationCandidate:
    source_id: str
    phot_g_mean_mag: float
    parallax: float
    lum_flame: float
    teff_gspphot: float
    mh_gspphot: float
    non_single_star: bool
    phot_variable_flag: str
    best_class_name: str
    radius_flame: float
    age_flame: float
    ra_degrees: float
    dec_degrees: float
    distance_parsecs: float
    absolute_magnitude: Optional[float]
    luminosity: float
    spectral_type: str
    color_index: Optional[float]
    constellation: str
    category: str
    distance_ly: float
    galactic_longitude_deg: float
    galactic_latitude_deg: float
    x_pc: float
    y_pc: float
    z_pc: float
    x: float
    y: float
    z: float


def parse_float(value: object) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_bool(value: object) -> Optional[bool]:
    if value in (None, ""):
        return None
    normalized = str(value).strip().lower()
    if normalized in {"true", "t", "1"}:
        return True
    if normalized in {"false", "f", "0"}:
        return False
    return None


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


def heliocentric_galactic_xyz(distance_pc: float, l_deg: float, b_deg: float) -> tuple[float, float, float]:
    l_rad = math.radians(l_deg)
    b_rad = math.radians(b_deg)
    cos_b = math.cos(b_rad)
    x_pc = distance_pc * cos_b * math.cos(l_rad)
    y_pc = distance_pc * cos_b * math.sin(l_rad)
    z_pc = distance_pc * math.sin(b_rad)
    return x_pc, y_pc, z_pc


def transformed_renderer_position(l_deg: float, b_deg: float, normalized_distance: float) -> tuple[float, float, float]:
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


def derive_constellation(ra_deg: float, dec_deg: float) -> str:
    coord = SkyCoord(ra=ra_deg * u.deg, dec=dec_deg * u.deg, frame="icrs")
    return coord.get_constellation(short_name=False)


def tap_create_async_job(query: str, timeout: int, opener) -> str:
    payload = urllib.parse.urlencode(
        {"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": query}
    ).encode()
    request = urllib.request.Request(GAIA_ASYNC_URL, data=payload, method="POST")
    with opener.open(request, timeout=timeout) as response:
        return response.headers.get("Location") or response.geturl()


def tap_run_job(job_url: str, timeout: int, opener) -> None:
    request = urllib.request.Request(
        f"{job_url}/phase",
        data=urllib.parse.urlencode({"PHASE": "RUN"}).encode(),
        method="POST",
    )
    with opener.open(request, timeout=timeout):
        return


def tap_wait_for_completion(job_url: str, timeout: int, opener) -> None:
    start = time.time()
    while True:
        with opener.open(f"{job_url}/phase", timeout=timeout) as response:
            phase = response.read().decode().strip()
        if phase == "COMPLETED":
            return
        if phase in {"ERROR", "ABORTED"}:
            detail = ""
            for candidate_url in (f"{job_url}/error", job_url):
                try:
                    with opener.open(candidate_url, timeout=timeout) as response:
                        detail = response.read().decode("utf-8", "ignore")
                    if detail:
                        break
                except Exception:
                    continue
            raise RuntimeError(f"Gaia TAP job failed with phase {phase}: {detail}")
        if time.time() - start > timeout:
            raise TimeoutError(f"Timed out waiting for Gaia TAP job at {job_url}")
        time.sleep(2)


def tap_fetch_csv_rows(job_url: str, timeout: int, opener) -> list[dict[str, str]]:
    result_urls = [f"{job_url}/results/result"]
    for attempt in range(5):
        for result_url in result_urls:
            try:
                with opener.open(result_url, timeout=timeout) as response:
                    payload = response.read().decode("utf-8", "ignore")
                return list(csv.DictReader(payload.splitlines()))
            except Exception:
                continue
        try:
            with opener.open(f"{job_url}/results", timeout=timeout) as response:
                results_payload = response.read().decode("utf-8", "ignore")
            hrefs = re.findall(r'xlink:href="([^"]+)"', results_payload)
            if hrefs:
                result_urls.extend([href for href in hrefs if href not in result_urls])
        except Exception:
            pass
        if attempt < 4:
            time.sleep(2)
    raise RuntimeError(f"Gaia TAP job completed but no CSV result was available at {job_url}")


def tap_query_rows(query: str, timeout: int = DEFAULT_GAIA_TIMEOUT_SECONDS) -> list[dict[str, str]]:
    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
    job_url = tap_create_async_job(query, timeout, opener)
    tap_run_job(job_url, timeout, opener)
    tap_wait_for_completion(job_url, timeout, opener)
    return tap_fetch_csv_rows(job_url, timeout, opener)


def _valuation_candidate_query(where_clause: str, top: int = 1) -> str:
    return f"""
SELECT TOP {top}
    gs.source_id,
    gs.ra,
    gs.dec,
    gs.phot_g_mean_mag,
    gs.parallax,
    gs.bp_rp,
    gs.non_single_star,
    gs.phot_variable_flag,
    ap.distance_gspphot,
    ap.mg_gspphot,
    ap.lum_flame,
    ap.spectraltype_esphs,
    ap.teff_gspphot,
    ap.mh_gspphot,
    ap.radius_flame,
    ap.age_flame,
    vc.best_class_name
FROM gaiadr3.gaia_source gs
JOIN gaiadr3.astrophysical_parameters ap ON gs.source_id = ap.source_id
LEFT OUTER JOIN (
    SELECT source_id, MAX(best_class_name) AS best_class_name
    FROM gaiadr3.vari_classifier_result
    GROUP BY source_id
) vc ON gs.source_id = vc.source_id
WHERE {where_clause}
  AND gs.phot_g_mean_mag IS NOT NULL
  AND gs.parallax IS NOT NULL
  AND gs.non_single_star IS NOT NULL
  AND gs.phot_variable_flag IS NOT NULL
  AND ap.distance_gspphot IS NOT NULL
  AND ap.distance_gspphot > 0
  AND ap.lum_flame IS NOT NULL
  AND ap.teff_gspphot IS NOT NULL
  AND ap.mh_gspphot IS NOT NULL
  AND ap.radius_flame IS NOT NULL
  AND ap.age_flame IS NOT NULL
  AND vc.best_class_name IS NOT NULL
""".strip()


def radial_bin_label(lo: float, hi: float) -> str:
    return f"{int(lo)}-{int(hi)} pc"


def query_metrics_for_source_id(source_id: str, timeout: int = DEFAULT_GAIA_TIMEOUT_SECONDS) -> Optional[GaiaValuationCandidate]:
    safe_source_id = str(int(source_id))
    rows = tap_query_rows(
        _valuation_candidate_query(f"gs.source_id = {safe_source_id}", top=1),
        timeout=timeout,
    )
    if not rows:
        return None
    return row_to_valuation_candidate(rows[0])


def query_metrics_for_source_ids(
    source_ids: list[str],
    timeout: int = DEFAULT_GAIA_TIMEOUT_SECONDS,
    batch_size: int = 25,
) -> dict[str, GaiaValuationCandidate]:
    results: dict[str, GaiaValuationCandidate] = {}
    numeric_source_ids = [str(int(source_id)) for source_id in source_ids if str(source_id).strip().isdigit()]

    def hydrate_batch(batch: list[str]) -> None:
        if not batch:
            return
        try:
            rows = tap_query_rows(
                _valuation_candidate_query(f"gs.source_id IN ({', '.join(batch)})", top=len(batch)),
                timeout=timeout,
            )
            for row in rows:
                candidate = row_to_valuation_candidate(row)
                if candidate is not None:
                    results[candidate.source_id] = candidate
            return
        except Exception:
            if len(batch) == 1:
                candidate = query_metrics_for_source_id(batch[0], timeout=timeout)
                if candidate is not None:
                    results[candidate.source_id] = candidate
                return
            midpoint = len(batch) // 2
            hydrate_batch(batch[:midpoint])
            hydrate_batch(batch[midpoint:])

    for start in range(0, len(numeric_source_ids), batch_size):
        batch = numeric_source_ids[start : start + batch_size]
        hydrate_batch(batch)
    return results


def resolve_source_id_by_coordinates(
    ra_degrees: float,
    dec_degrees: float,
    apparent_magnitude: Optional[float] = None,
    search_radius_arcsec: float = 30.0,
    timeout: int = DEFAULT_GAIA_TIMEOUT_SECONDS,
) -> Optional[str]:
    candidate = query_candidate_by_coordinates(
        ra_degrees=ra_degrees,
        dec_degrees=dec_degrees,
        apparent_magnitude=apparent_magnitude,
        search_radius_arcsec=search_radius_arcsec,
        timeout=timeout,
    )
    return candidate.source_id if candidate is not None else None


def query_candidate_by_coordinates(
    ra_degrees: float,
    dec_degrees: float,
    apparent_magnitude: Optional[float] = None,
    search_radius_arcsec: float = 30.0,
    timeout: int = DEFAULT_GAIA_TIMEOUT_SECONDS,
) -> Optional[GaiaValuationCandidate]:
    for radius_arcsec in (search_radius_arcsec, max(search_radius_arcsec, 120.0), max(search_radius_arcsec, 600.0)):
        rows = tap_query_rows(
            _valuation_candidate_query(
                (
                    "1 = CONTAINS("
                    f"POINT('ICRS', gs.ra, gs.dec), CIRCLE('ICRS', {ra_degrees}, {dec_degrees}, {radius_arcsec / 3600.0}))"
                ),
                top=25,
            )
            + "\nORDER BY gs.source_id ASC",
            timeout=timeout,
        )
        candidates: list[tuple[float, GaiaValuationCandidate]] = []
        for row in rows:
            candidate = row_to_valuation_candidate(row)
            if candidate is None:
                continue
            score = abs(candidate.ra_degrees - ra_degrees) + abs(candidate.dec_degrees - dec_degrees)
            if apparent_magnitude is not None:
                score += abs(candidate.phot_g_mean_mag - apparent_magnitude) * 0.2
            candidates.append((score, candidate))
        if candidates:
            candidates.sort(key=lambda item: (item[0], int(item[1].source_id)))
            return candidates[0][1]
    return None


def fetch_eligible_valuation_pool(
    limit: int = 7000,
    timeout: int = DEFAULT_GAIA_TIMEOUT_SECONDS,
) -> list[GaiaValuationCandidate]:
    rows = tap_query_rows(
        _valuation_candidate_query("gs.random_index IS NOT NULL", top=limit) + "\nORDER BY gs.random_index ASC",
        timeout=timeout,
    )
    candidates = []
    seen_source_ids = set()
    for row in rows:
        candidate = row_to_valuation_candidate(row)
        if candidate is None or candidate.source_id in seen_source_ids:
            continue
        seen_source_ids.add(candidate.source_id)
        candidates.append(candidate)
    return candidates


def fetch_balanced_eligible_valuation_pool(
    distance_bins_pc: list[float] | None = None,
    top_per_bin: int = 1000,
    timeout: int = DEFAULT_GAIA_TIMEOUT_SECONDS,
) -> tuple[list[GaiaValuationCandidate], dict[str, int]]:
    bins = distance_bins_pc or DEFAULT_VALUATION_DISTANCE_BINS_PC
    candidates: list[GaiaValuationCandidate] = []
    seen_source_ids: set[str] = set()
    diagnostics: dict[str, int] = {}

    for lo, hi in zip(bins[:-1], bins[1:]):
        label = radial_bin_label(lo, hi)
        rows: list[dict[str, str]] = []
        last_error: Exception | None = None
        attempts = []
        for candidate_top in (top_per_bin, max(600, top_per_bin // 2), max(250, top_per_bin // 4)):
            if candidate_top in attempts:
                continue
            attempts.append(candidate_top)
            try:
                rows = tap_query_rows(
                    _valuation_candidate_query(
                        (
                            "gs.random_index IS NOT NULL "
                            f"AND ap.distance_gspphot >= {lo} "
                            f"AND ap.distance_gspphot < {hi}"
                        ),
                        top=candidate_top,
                    ) + "\nORDER BY gs.random_index ASC",
                    timeout=timeout,
                )
                break
            except Exception as exc:
                last_error = exc
        if not rows and last_error is not None:
            raise last_error

        added = 0
        for row in rows:
            candidate = row_to_valuation_candidate(row)
            if candidate is None or candidate.source_id in seen_source_ids:
                continue
            seen_source_ids.add(candidate.source_id)
            candidates.append(candidate)
            added += 1
        diagnostics[label] = added

    return candidates, diagnostics


def find_replacement_candidate(
    used_source_ids: set[str],
    target_mag: Optional[float],
    target_parallax: Optional[float],
    timeout: int = DEFAULT_GAIA_TIMEOUT_SECONDS,
) -> Optional[GaiaValuationCandidate]:
    order_parts = []
    if target_mag is not None:
        order_parts.append(f"ABS(gs.phot_g_mean_mag - {target_mag}) ASC")
    if target_parallax is not None:
        order_parts.append(f"ABS(gs.parallax - {target_parallax}) ASC")
    order_parts.append("gs.source_id ASC")
    rows = tap_query_rows(
        _valuation_candidate_query("gs.source_id IS NOT NULL", top=250)
        + f"\nORDER BY {', '.join(order_parts)}",
        timeout=timeout,
    )
    for row in rows:
        source_id = str(row.get("source_id") or "")
        if not source_id or source_id in used_source_ids:
            continue
        candidate = row_to_valuation_candidate(row)
        if candidate is not None:
            return candidate
    return None


def row_to_valuation_candidate(row: dict[str, str]) -> Optional[GaiaValuationCandidate]:
    source_id = str(row.get("source_id") or "").strip()
    ra_degrees = parse_float(row.get("ra"))
    dec_degrees = parse_float(row.get("dec"))
    phot_g_mean_mag = parse_float(row.get("phot_g_mean_mag"))
    parallax = parse_float(row.get("parallax"))
    distance_parsecs = parse_float(row.get("distance_gspphot"))
    absolute_magnitude = parse_float(row.get("mg_gspphot"))
    lum_flame = parse_float(row.get("lum_flame"))
    teff_gspphot = parse_float(row.get("teff_gspphot"))
    mh_gspphot = parse_float(row.get("mh_gspphot"))
    radius_flame = parse_float(row.get("radius_flame"))
    age_flame = parse_float(row.get("age_flame"))
    color_index = parse_float(row.get("bp_rp"))
    non_single_star = parse_bool(row.get("non_single_star"))
    phot_variable_flag = str(row.get("phot_variable_flag") or "").strip()
    best_class_name = str(row.get("best_class_name") or "").strip()
    spectral_type = str(row.get("spectraltype_esphs") or "").strip().replace('"', "")

    required = [
        source_id,
        ra_degrees,
        dec_degrees,
        phot_g_mean_mag,
        parallax,
        distance_parsecs,
        lum_flame,
        teff_gspphot,
        mh_gspphot,
        radius_flame,
        age_flame,
        non_single_star,
        phot_variable_flag,
        best_class_name,
    ]
    if any(value in (None, "") for value in required):
        return None

    if absolute_magnitude is None:
        absolute_magnitude = absolute_mag_from_distance(phot_g_mean_mag, distance_parsecs)

    coord = SkyCoord(ra=ra_degrees * u.deg, dec=dec_degrees * u.deg, distance=distance_parsecs * u.pc, frame="icrs")
    gal = coord.galactic
    galactic_longitude_deg = gal.l.degree
    galactic_latitude_deg = gal.b.degree
    x_pc, y_pc, z_pc = heliocentric_galactic_xyz(distance_parsecs, galactic_longitude_deg, galactic_latitude_deg)
    normalized_distance = min(1.0, max(distance_parsecs, 0.0) / DEFAULT_MAX_DISTANCE_PC)
    x, y, z = transformed_renderer_position(galactic_longitude_deg, galactic_latitude_deg, normalized_distance)
    constellation = derive_constellation(ra_degrees, dec_degrees)

    return GaiaValuationCandidate(
        source_id=source_id,
        phot_g_mean_mag=phot_g_mean_mag,
        parallax=parallax,
        lum_flame=lum_flame,
        teff_gspphot=teff_gspphot,
        mh_gspphot=mh_gspphot,
        non_single_star=bool(non_single_star),
        phot_variable_flag=phot_variable_flag,
        best_class_name=best_class_name,
        radius_flame=radius_flame,
        age_flame=age_flame,
        ra_degrees=ra_degrees,
        dec_degrees=dec_degrees,
        distance_parsecs=distance_parsecs,
        absolute_magnitude=absolute_magnitude,
        luminosity=lum_flame,
        spectral_type=spectral_type or "",
        color_index=color_index,
        constellation=constellation,
        category=derive_star_class_label(spectral_type),
        distance_ly=distance_parsecs * 3.26156,
        galactic_longitude_deg=galactic_longitude_deg,
        galactic_latitude_deg=galactic_latitude_deg,
        x_pc=x_pc,
        y_pc=y_pc,
        z_pc=z_pc,
        x=x,
        y=y,
        z=z,
    )
