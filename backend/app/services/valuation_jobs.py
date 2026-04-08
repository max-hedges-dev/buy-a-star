from __future__ import annotations

import datetime as dt
import logging

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.services.market_inputs import MarketInputSnapshot, build_daily_market_snapshot
from app.services.star_valuation import money_decimal, recalculate_model_values, sync_external_market_inputs


logger = logging.getLogger(__name__)


async def run_daily_valuation_job(target_date: dt.date | None = None) -> dict:
    effective_date = target_date or dt.date.today()

    async with AsyncSessionLocal() as db:
        fallback_used = False
        try:
            snapshot = build_daily_market_snapshot(
                provider=settings.STAR_VALUATION_PROVIDER,
                target_date=effective_date,
            )
        except Exception as exc:
            fallback_used = True
            logger.warning("Daily valuation market snapshot fallback engaged: %s", exc)
            snapshot = MarketInputSnapshot(
                provider=settings.STAR_VALUATION_PROVIDER,
                market_date=effective_date,
                energy_symbol=settings.STAR_VALUATION_ENERGY_SYMBOL,
                metals_symbol=settings.STAR_VALUATION_METALS_SYMBOL,
                energy_price=money_decimal(1),
                metals_price=money_decimal(1),
                energy_change_ratio=0.0,
                metals_change_ratio=0.0,
                raw_payload={"fallback": True},
            )

        synced = await sync_external_market_inputs(db, [snapshot])
        summary = await recalculate_model_values(
            db,
            valuation_dates=[item.market_date for item in synced],
        )
        await db.commit()

    payload = {
        "market_date": str(effective_date),
        "fallback_used": fallback_used,
        **summary,
    }
    logger.info("Daily valuation job completed: %s", payload)
    return payload
