from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status

from app.core.config import settings

DEFAULT_CERTIFICATE_TYPE = "digital"


@dataclass(frozen=True)
class CertificateOption:
    code: str
    label: str
    description: str
    shipping_required: bool
    base_price_minor_units: int

    @property
    def price_minor_units(self) -> int:
        return self.base_price_minor_units

    @property
    def product_catalog_key(self) -> str:
        return f"certificate_{self.code}"

    @property
    def price_lookup_key(self) -> str:
        return f"{self.product_catalog_key}_gbp"


def list_certificate_options() -> list[CertificateOption]:
    return [
        CertificateOption(
            code="digital",
            label="Digital Certificate",
            description="Delivered immediately as a high-resolution digital certificate.",
            shipping_required=False,
            base_price_minor_units=settings.STRIPE_DIGITAL_CERTIFICATE_PRICE_GBP,
        ),
        CertificateOption(
            code="a4_paper",
            label="A4 Paper Certificate",
            description="Printed on A4 paper and shipped to the delivery address entered at checkout.",
            shipping_required=True,
            base_price_minor_units=settings.STRIPE_A4_PAPER_CERTIFICATE_PRICE_GBP,
        ),
        CertificateOption(
            code="a4_laminated_paper",
            label="A4 Laminated Paper Certificate",
            description="Printed on A4 paper, laminated, and shipped to the delivery address entered at checkout.",
            shipping_required=True,
            base_price_minor_units=settings.STRIPE_A4_LAMINATED_PAPER_CERTIFICATE_PRICE_GBP,
        ),
        CertificateOption(
            code="a4_card",
            label="A4 Card Certificate",
            description="Printed on A4 card stock and shipped to the delivery address entered at checkout.",
            base_price_minor_units=settings.STRIPE_A4_CARD_CERTIFICATE_PRICE_GBP,
            shipping_required=True,
        ),
    ]


def get_certificate_option(code: str) -> CertificateOption:
    normalized_code = (code or DEFAULT_CERTIFICATE_TYPE).strip().lower()
    for option in list_certificate_options():
        if option.code == normalized_code:
            return option

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unknown certificate option selected.",
    )


def certificate_label(code: str) -> str:
    return get_certificate_option(code).label
