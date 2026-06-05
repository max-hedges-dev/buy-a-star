from __future__ import annotations

from decimal import Decimal
from datetime import datetime, timezone
import math
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.registration import Registration
from app.models.star import Star
from app.models.transaction import Transaction
from app.models.user import User
from app.api.deps import get_current_user_optional
from app.core.config import settings
from app.schemas.star import (
    StarCatalogueFacetsRead,
    StarCatalogueRead,
    StarDetailRead,
    StarListRead,
)
from app.services.stripe_checkout import get_effective_hold_expires_at


router = APIRouter()


def _float(value: Decimal | float | int | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _configured_registration_price(star: Star) -> float:
    if star.common_name and star.common_name.strip():
        return settings.STRIPE_NAMED_STAR_PRICE_GBP / 100
    return settings.STRIPE_UNNAMED_STAR_PRICE_GBP / 100


def serialize_star(star: Star) -> dict:
    first_purchase_price = _configured_registration_price(star)
    current_price = _float(star.model_value) or first_purchase_price
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
        "current_owner_user_id": star.current_owner_user_id,
        "registration_id": None,
        "public_page_slug": None,
        "current_holder_username": None,
        "x": star.x,
        "y": star.y,
        "z": star.z,
    }


async def _latest_registrations_by_star(db: AsyncSession, star_ids: list[int]) -> dict[int, Registration]:
    if not star_ids:
        return {}

    result = await db.execute(
        select(Registration)
        .where(Registration.star_id.in_(star_ids))
        .order_by(Registration.star_id.asc(), Registration.created_at.desc(), Registration.id.desc())
    )
    registrations_by_star: dict[int, Registration] = {}
    for registration in result.scalars().all():
        registrations_by_star.setdefault(registration.star_id, registration)
    return registrations_by_star


async def _usernames_by_id(db: AsyncSession, user_ids: set[int | None]) -> dict[int, str]:
    normalized_user_ids = {user_id for user_id in user_ids if user_id is not None}
    if not normalized_user_ids:
        return {}

    result = await db.execute(select(User.id, User.username).where(User.id.in_(normalized_user_ids)))
    return {user_id: username for user_id, username in result.all() if username}


async def _serialize_star_collection(
    db: AsyncSession,
    stars: list[Star],
    current_user: User | None = None,
) -> list[dict]:
    registrations_by_star = await _latest_registrations_by_star(db, [star.id for star in stars])
    usernames_by_id = await _usernames_by_id(
        db,
        {registration.current_holder_user_id for registration in registrations_by_star.values()},
    )
    active_holds_by_star = await _active_holds_for_stars(db, star_ids=[star.id for star in stars])

    serialized = []
    for star in stars:
        payload = serialize_star(star)
        registration = registrations_by_star.get(star.id)
        if registration is not None:
            payload["registration_id"] = registration.id
            payload["public_page_slug"] = registration.public_page_slug
            payload["current_holder_username"] = usernames_by_id.get(registration.current_holder_user_id)
        active_hold = active_holds_by_star.get(star.id)
        if active_hold is not None:
            payload["active_hold_expires_at"] = get_effective_hold_expires_at(active_hold)
            payload["hold_owner_name"] = active_hold.owner_name
            payload["held_in_another_cart"] = current_user is None or active_hold.user_id != current_user.id
            if current_user is not None and active_hold.user_id == current_user.id:
                payload["current_user_cart_transaction_id"] = active_hold.id
                payload["current_user_cart_hold_active"] = True
        serialized.append(payload)
    return serialized


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


def _name_sort_expression():
    return func.lower(func.coalesce(Star.common_name, Star.display_name, Star.scientific_name, ""))


def _current_price_expression():
    return Star.model_value


def _apply_search(query, search: str | None):
    if not search:
        return query

    search_pattern = f"%{search.strip()}%"
    return query.where(
        or_(
            Star.common_name.ilike(search_pattern),
            Star.display_name.ilike(search_pattern),
            Star.scientific_name.ilike(search_pattern),
            Star.constellation.ilike(search_pattern),
        )
    )


def _apply_colour_filter(query, colour: str | None):
    if not colour or colour == "all":
        return query

    normalized = colour.strip().lower()
    category = func.lower(func.coalesce(Star.category, ""))
    colour_conditions = {
        "blue": and_(category.like("%blue%"), ~category.like("%blue-white%")),
        "blue-white": category.like("%blue-white%"),
        "white": and_(
            category.like("%white%"),
            ~category.like("%blue-white%"),
            ~category.like("%yellow-white%"),
        ),
        "yellow-white": category.like("%yellow-white%"),
        "yellow": and_(category.like("%yellow%"), ~category.like("%yellow-white%")),
        "orange": category.like("%orange%"),
        "red": category.like("%red%"),
    }

    condition = colour_conditions.get(normalized)
    if condition is None:
        return query

    return query.where(condition)


def _apply_catalogue_filters(
    query,
    *,
    search: str | None,
    status: str | None,
    colour: str | None,
    constellation: str | None,
    star_type: str | None,
    min_distance_ly: float | None,
    max_distance_ly: float | None,
    min_price: float | None,
    max_price: float | None,
):
    query = _apply_search(query, search)

    if status == "owned":
        query = query.where(Star.is_bought.is_(True))
    elif status == "available":
        query = query.where(Star.is_bought.is_(False))

    query = _apply_colour_filter(query, colour)

    if constellation and constellation != "all":
        query = query.where(Star.constellation == constellation)

    if star_type and star_type != "all":
        query = query.where(Star.category == star_type)

    if min_distance_ly is not None and min_distance_ly > 0:
        query = query.where(Star.distance_ly >= min_distance_ly)

    if max_distance_ly is not None and max_distance_ly > 0:
        query = query.where(Star.distance_ly <= max_distance_ly)

    current_price = _current_price_expression()
    if min_price is not None and min_price > 0:
        query = query.where(current_price >= min_price)

    if max_price is not None and max_price > 0:
        query = query.where(current_price <= max_price)

    return query


def _apply_catalogue_sort(query, sort_by: str | None):
    name_sort = _name_sort_expression()
    sort_key = sort_by or "alphabetical"

    if sort_key == "distance-near":
        return query.order_by(Star.distance_ly.asc(), name_sort.asc())
    if sort_key == "distance-far":
        return query.order_by(Star.distance_ly.desc(), name_sort.asc())
    if sort_key in {"brightness", "apparent-brightest"}:
        return query.order_by(Star.apparent_magnitude.asc().nullslast(), name_sort.asc())
    if sort_key == "apparent-dimmest":
        return query.order_by(Star.apparent_magnitude.desc().nullslast(), name_sort.asc())
    if sort_key == "absolute-brightest":
        return query.order_by(Star.absolute_magnitude.asc().nullslast(), name_sort.asc())
    if sort_key == "absolute-dimmest":
        return query.order_by(Star.absolute_magnitude.desc().nullslast(), name_sort.asc())
    if sort_key == "price-low":
        return query.order_by(_current_price_expression().asc().nullslast(), name_sort.asc())
    if sort_key == "price-high":
        return query.order_by(_current_price_expression().desc().nullslast(), name_sort.asc())
    if sort_key == "registered-first":
        return query.order_by(Star.is_bought.desc(), name_sort.asc())

    return query.order_by(name_sort.asc())


def _catalogue_status_conditions(status: str | None):
    if status == "owned":
        return [Star.is_bought.is_(True)]
    if status == "available":
        return [Star.is_bought.is_(False)]
    return []


async def _build_catalogue_facets(db: AsyncSession, status: str | None) -> StarCatalogueFacetsRead:
    status_conditions = _catalogue_status_conditions(status)
    constellations_result = await db.execute(
        select(Star.constellation)
        .where(Star.constellation.is_not(None))
        .where(*status_conditions)
        .distinct()
        .order_by(Star.constellation.asc())
    )
    star_types_result = await db.execute(
        select(Star.category)
        .where(Star.category.is_not(None))
        .where(*status_conditions)
        .distinct()
        .order_by(Star.category.asc())
    )
    distance_bounds_result = await db.execute(
        select(func.min(Star.distance_ly), func.max(Star.distance_ly)).where(*status_conditions)
    )
    price_bounds_result = await db.execute(
        select(func.min(_current_price_expression()), func.max(_current_price_expression())).where(*status_conditions)
    )
    min_distance, max_distance = distance_bounds_result.one()
    min_price, max_price = price_bounds_result.one()

    return StarCatalogueFacetsRead(
        constellations=[value for value in constellations_result.scalars().all() if value],
        star_types=[value for value in star_types_result.scalars().all() if value],
        min_distance_ly=float(min_distance or 0),
        max_distance_ly=float(max_distance or 0),
        min_price=float(min_price or 0),
        max_price=float(max_price or 0),
    )

async def _current_user_cart_transaction_for_star(
    db: AsyncSession,
    *,
    star_id: int,
    user_id: int | None,
) -> Transaction | None:
    if user_id is None:
        return None

    result = await db.execute(
        select(Transaction)
        .where(
            Transaction.star_id == star_id,
            Transaction.user_id == user_id,
            Transaction.status.in_(["checkout_created", "expired", "payment_failed"]),
        )
        .order_by(Transaction.created_at.desc(), Transaction.id.desc())
    )
    return result.scalars().first()


async def _active_holds_for_stars(
    db: AsyncSession,
    *,
    star_ids: list[int],
) -> dict[int, Transaction]:
    if not star_ids:
        return {}

    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Transaction)
        .where(
            Transaction.star_id.in_(star_ids),
            Transaction.status == "checkout_created",
        )
        .order_by(Transaction.star_id.asc(), Transaction.created_at.desc(), Transaction.id.desc())
    )
    holds_by_star: dict[int, Transaction] = {}
    for transaction in result.scalars().all():
        effective_expires_at = get_effective_hold_expires_at(transaction)
        if effective_expires_at and effective_expires_at > now:
            holds_by_star.setdefault(transaction.star_id, transaction)
    return holds_by_star


async def build_star_detail_response(star: Star, db: AsyncSession, current_user: User | None = None) -> StarDetailRead:
    registration_result = await db.execute(
        select(Registration).where(Registration.star_id == star.id).order_by(Registration.created_at.desc(), Registration.id.desc())
    )
    registration = registration_result.scalars().first()
    public_registration = None
    if registration and registration.public_page_visibility == "public":
        usernames_by_id = await _usernames_by_id(db, {registration.current_holder_user_id})
        public_registration = {
            "registration_id": registration.id,
            "registration_number": registration.registration_number,
            "status": registration.status,
            "registered_display_name": registration.registered_display_name,
            "dedication": registration.dedication,
            "is_gift": registration.is_gift,
            "claim_status": registration.claim_status,
            "public_page_slug": registration.public_page_slug,
            "current_holder_username": usernames_by_id.get(registration.current_holder_user_id),
            "starwiki_url": f"/starwiki/{registration.public_page_slug}",
        }

    detail_payload = serialize_star(star)
    if registration is not None:
        usernames_by_id = await _usernames_by_id(db, {registration.current_holder_user_id})
        detail_payload["registration_id"] = registration.id
        detail_payload["public_page_slug"] = registration.public_page_slug
        detail_payload["current_holder_username"] = usernames_by_id.get(registration.current_holder_user_id)

    cart_transaction = await _current_user_cart_transaction_for_star(
        db,
        star_id=star.id,
        user_id=current_user.id if current_user else None,
    )
    if cart_transaction is not None:
        detail_payload["current_user_cart_transaction_id"] = cart_transaction.id
        detail_payload["current_user_cart_hold_active"] = bool(
            get_effective_hold_expires_at(cart_transaction)
            and get_effective_hold_expires_at(cart_transaction) > datetime.now(timezone.utc)
        )
    active_hold = (await _active_holds_for_stars(db, star_ids=[star.id])).get(star.id)
    if active_hold is not None:
        detail_payload["active_hold_expires_at"] = get_effective_hold_expires_at(active_hold)
        detail_payload["hold_owner_name"] = active_hold.owner_name
        detail_payload["held_in_another_cart"] = current_user is None or active_hold.user_id != current_user.id

    return StarDetailRead(
        **detail_payload,
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
        public_registration=public_registration,
    )


@router.get("", response_model=list[StarListRead])
@router.get("/", response_model=list[StarListRead])
async def read_stars(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
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
    return [StarListRead(**payload) for payload in await _serialize_star_collection(db, stars, current_user)]


@router.get("/catalogue", response_model=StarCatalogueRead)
async def read_star_catalogue(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
    page: int = 1,
    page_size: int = 24,
    search: Optional[str] = None,
    status: Optional[str] = "all",
    colour: Optional[str] = "all",
    constellation: Optional[str] = "all",
    star_type: Optional[str] = "all",
    min_distance_ly: Optional[float] = None,
    max_distance_ly: Optional[float] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: Optional[str] = "alphabetical",
):
    safe_page_size = min(max(page_size, 1), 96)
    safe_page = max(page, 1)

    filtered_query = _apply_catalogue_filters(
        select(Star),
        search=search,
        status=status,
        colour=colour,
        constellation=constellation,
        star_type=star_type,
        min_distance_ly=min_distance_ly,
        max_distance_ly=max_distance_ly,
        min_price=min_price,
        max_price=max_price,
    )

    total_result = await db.execute(
        select(func.count()).select_from(filtered_query.order_by(None).subquery())
    )
    total = int(total_result.scalar() or 0)
    total_pages = max(1, math.ceil(total / safe_page_size))
    bounded_page = min(safe_page, total_pages)

    items_query = (
        _apply_catalogue_sort(filtered_query, sort_by)
        .offset((bounded_page - 1) * safe_page_size)
        .limit(safe_page_size)
    )
    items_result = await db.execute(items_query)
    stars = items_result.scalars().all()
    serialized_stars = await _serialize_star_collection(db, stars, current_user)

    return StarCatalogueRead(
        items=[StarListRead(**payload) for payload in serialized_stars],
        total=total,
        page=bounded_page,
        page_size=safe_page_size,
        total_pages=total_pages,
        facets=await _build_catalogue_facets(db, status),
    )


@router.get("/slug/{star_slug}", response_model=StarDetailRead)
async def read_star_by_slug(
    star_slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    normalized_slug = slugify_star_name(star_slug)
    result = await db.execute(select(Star))
    for star in result.scalars().all():
        if normalized_slug in get_star_slug_candidates(star):
            return await build_star_detail_response(star, db, current_user)

    raise HTTPException(status_code=404, detail="Star not found")


@router.get("/{star_id}", response_model=StarDetailRead)
async def read_star(
    star_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    result = await db.execute(select(Star).filter(Star.id == star_id))
    star = result.scalars().first()
    if star is None:
        raise HTTPException(status_code=404, detail="Star not found")

    return await build_star_detail_response(star, db, current_user)
