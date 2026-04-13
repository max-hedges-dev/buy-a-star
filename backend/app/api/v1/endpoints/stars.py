from __future__ import annotations

from decimal import Decimal
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.star import Star
from app.models.star_valuation_history import StarValuationHistory
from app.core.config import settings
from app.schemas.star import StarDetailRead, StarListRead, StarValuationHistoryPointRead


router = APIRouter()


def _float(value: Decimal | float | int | None) -> float | None:
    if value is None:
        return None
    return float(value)


def serialize_star(star: Star) -> dict:
    first_purchase_price = float(settings.STAR_ISSUE_PRICE)
    current_price = _float(star.ask_price) or first_purchase_price
    return {
        "id": star.id,
        "scientific_name": star.scientific_name,
        "common_name": star.common_name,
        "catalog_id": star.catalog_id,
        "canonical_id": star.canonical_id,
        "identifier_type": star.identifier_type,
        "source_catalog": star.source_catalog,
        "source_id": star.source_id,
        "display_name": star.display_name,
        "category": star.category,
        "price": current_price,
        "first_purchase_price": first_purchase_price,
        "model_value": _float(star.model_value),
        "ask_price": _float(star.ask_price),
        "highest_bid": _float(star.highest_bid),
        "last_sale_price": _float(star.last_sale_price),
        "last_sale_at": star.last_sale_at,
        "distance_ly": star.distance_ly,
        "is_bought": bool(star.is_bought),
        "owner_name": star.owner_name,
        "purchase_date": star.purchase_date,
        "valuation_eligible": bool(star.valuation_eligible),
        "valuation_missing_metrics": list(star.valuation_missing_metrics or []) or None,
        "model_value_last_calculated_at": star.model_value_last_calculated_at,
        "gaia_source_id": star.gaia_source_id,
        "hyg_id": star.hyg_id,
        "hip": star.hip,
        "hd": star.hd,
        "hr": star.hr,
        "gl": star.gl,
        "bf": star.bf,
        "bayer": star.bayer,
        "flamsteed": star.flamsteed,
        "constellation": star.constellation,
        "spectral_type": star.spectral_type,
        "ra_degrees": star.ra_degrees,
        "ra_hours": star.ra_hours,
        "dec_degrees": star.dec_degrees,
        "distance_parsecs": star.distance_parsecs,
        "galactic_longitude_deg": star.galactic_longitude_deg,
        "galactic_latitude_deg": star.galactic_latitude_deg,
        "x_pc": star.x_pc,
        "y_pc": star.y_pc,
        "z_pc": star.z_pc,
        "apparent_magnitude": star.apparent_magnitude,
        "absolute_magnitude": star.absolute_magnitude,
        "luminosity": star.luminosity,
        "color_index": star.color_index,
        "bp_rp": star.bp_rp,
        "bp_g": star.bp_g,
        "g_rp": star.g_rp,
        "radial_velocity": star.radial_velocity,
        "pm": star.pm,
        "pmra": star.pmra,
        "pmdec": star.pmdec,
        "variable_designation": star.variable_designation,
        "variable_min": star.variable_min,
        "variable_max": star.variable_max,
        "valuation_scores": star.valuation_scores,
        "valuation_debug": star.valuation_debug,
        "x": star.x,
        "y": star.y,
        "z": star.z,
    }


def slugify_star_name(value: str | None) -> str:
    normalized = (value or "").lower().strip().replace("'", "").replace("’", "").replace(".", "")
    return re.sub(r"(^-+|-+$)", "", re.sub(r"[^a-z0-9]+", "-", normalized))


def get_star_slug(star: Star) -> str:
    return slugify_star_name(star.common_name or star.display_name or star.scientific_name)


def get_star_slug_candidates(star: Star) -> set[str]:
    values = {
        star.common_name,
        star.display_name,
        star.scientific_name,
        star.catalog_id,
        star.canonical_id,
        star.source_id,
        star.gaia_source_id,
    }

    if star.source_catalog and star.source_id:
        values.add(f"{star.source_catalog} {star.source_id}")

    return {slugify_star_name(value) for value in values if value}


async def build_star_detail_response(star: Star, db: AsyncSession) -> StarDetailRead:
    history_result = await db.execute(
        select(StarValuationHistory)
        .where(StarValuationHistory.star_id == star.id)
        .order_by(StarValuationHistory.valuation_date.asc())
    )
    history = [
        StarValuationHistoryPointRead(
            valuation_date=item.valuation_date,
            model_value=float(item.model_value),
            energy_price=_float(item.energy_price),
            metals_price=_float(item.metals_price),
            energy_change_ratio=item.energy_change_ratio,
            metals_change_ratio=item.metals_change_ratio,
        )
        for item in history_result.scalars().all()
    ]

    return StarDetailRead(
        **serialize_star(star),
        phot_g_mean_mag=star.phot_g_mean_mag,
        parallax=star.parallax,
        lum_flame=star.lum_flame,
        teff_gspphot=star.teff_gspphot,
        mh_gspphot=star.mh_gspphot,
        non_single_star=star.non_single_star,
        phot_variable_flag=star.phot_variable_flag,
        best_class_name=star.best_class_name,
        radius_flame=star.radius_flame,
        mass_flame=star.mass_flame,
        age_flame=star.age_flame,
        evolstage_flame=star.evolstage_flame,
        classprob_dsc_combmod_binarystar=star.classprob_dsc_combmod_binarystar,
        valuation_history=history,
    )


@router.get("")
@router.get("/", response_model=list[StarListRead])
async def read_stars(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    is_bought: Optional[bool] = None,
):
    query = select(Star)
    if search:
        query = query.filter(Star.common_name.ilike(f"%{search}%") | Star.scientific_name.ilike(f"%{search}%"))
    if is_bought is not None:
        query = query.filter(Star.is_bought == is_bought)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    stars = result.scalars().all()
    return [StarListRead(**serialize_star(star)) for star in stars]


@router.get("/slug/{star_slug}", response_model=StarDetailRead)
async def read_star_by_slug(star_slug: str, db: AsyncSession = Depends(get_db)):
    normalized_slug = slugify_star_name(star_slug)
    result = await db.execute(select(Star))
    for star in result.scalars().all():
        if normalized_slug in get_star_slug_candidates(star):
            return await build_star_detail_response(star, db)

    raise HTTPException(status_code=404, detail="Star not found")


@router.get("/{star_id}", response_model=StarDetailRead)
async def read_star(star_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Star).filter(Star.id == star_id))
    star = result.scalars().first()
    if star is None:
        raise HTTPException(status_code=404, detail="Star not found")

    return await build_star_detail_response(star, db)
