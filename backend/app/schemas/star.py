from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel


class StarValuationHistoryPointRead(BaseModel):
    valuation_date: date
    model_value: float
    energy_price: Optional[float] = None
    metals_price: Optional[float] = None
    energy_change_ratio: Optional[float] = None
    metals_change_ratio: Optional[float] = None


class StarBase(BaseModel):
    scientific_name: str
    common_name: Optional[str] = None
    catalog_id: Optional[str] = None
    canonical_id: Optional[str] = None
    identifier_type: Optional[str] = None
    source_catalog: Optional[str] = None
    source_id: Optional[str] = None
    display_name: Optional[str] = None
    category: str
    price: float
    first_purchase_price: float
    model_value: Optional[float] = None
    ask_price: Optional[float] = None
    highest_bid: Optional[float] = None
    last_sale_price: Optional[float] = None
    last_sale_at: Optional[datetime] = None
    distance_ly: float
    is_bought: bool = False
    owner_name: Optional[str] = None
    purchase_date: Optional[datetime] = None
    valuation_eligible: bool = False
    valuation_missing_metrics: Optional[list[str]] = None
    model_value_last_calculated_at: Optional[datetime] = None
    gaia_source_id: Optional[str] = None
    hyg_id: Optional[int] = None
    hip: Optional[int] = None
    hd: Optional[int] = None
    hr: Optional[int] = None
    gl: Optional[str] = None
    bf: Optional[str] = None
    bayer: Optional[str] = None
    flamsteed: Optional[int] = None
    constellation: Optional[str] = None
    spectral_type: Optional[str] = None
    ra_degrees: Optional[float] = None
    ra_hours: Optional[float] = None
    dec_degrees: Optional[float] = None
    distance_parsecs: Optional[float] = None
    galactic_longitude_deg: Optional[float] = None
    galactic_latitude_deg: Optional[float] = None
    x_pc: Optional[float] = None
    y_pc: Optional[float] = None
    z_pc: Optional[float] = None
    apparent_magnitude: Optional[float] = None
    absolute_magnitude: Optional[float] = None
    luminosity: Optional[float] = None
    color_index: Optional[float] = None
    bp_rp: Optional[float] = None
    bp_g: Optional[float] = None
    g_rp: Optional[float] = None
    radial_velocity: Optional[float] = None
    pm: Optional[float] = None
    pmra: Optional[float] = None
    pmdec: Optional[float] = None
    variable_designation: Optional[str] = None
    variable_min: Optional[float] = None
    variable_max: Optional[float] = None
    valuation_scores: Optional[dict[str, Any]] = None
    valuation_debug: Optional[dict[str, Any]] = None


class StarListRead(StarBase):
    id: int
    x: float
    y: float
    z: float


class StarDetailRead(StarListRead):
    phot_g_mean_mag: Optional[float] = None
    parallax: Optional[float] = None
    lum_flame: Optional[float] = None
    teff_gspphot: Optional[float] = None
    mh_gspphot: Optional[float] = None
    non_single_star: Optional[bool] = None
    phot_variable_flag: Optional[str] = None
    best_class_name: Optional[str] = None
    radius_flame: Optional[float] = None
    mass_flame: Optional[float] = None
    age_flame: Optional[float] = None
    evolstage_flame: Optional[float] = None
    classprob_dsc_combmod_binarystar: Optional[float] = None
    valuation_history: list[StarValuationHistoryPointRead] = []


class StarPurchaseRequest(BaseModel):
    owner_name: str
    payment_method: str = "paypal"
    include_certificate: bool = True
