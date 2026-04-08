import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.services.valuation_jobs import run_daily_valuation_job


logger = logging.getLogger(__name__)


def _scheduler_timezone():
    try:
        return ZoneInfo(settings.STAR_VALUATION_SCHEDULE_TIMEZONE)
    except ZoneInfoNotFoundError:
        logger.warning(
            "Scheduler timezone %s was not found; falling back to UTC.",
            settings.STAR_VALUATION_SCHEDULE_TIMEZONE,
        )
        return UTC


async def _daily_valuation_scheduler_loop() -> None:
    timezone = _scheduler_timezone()
    while True:
        now = datetime.now(timezone)
        next_run = now.replace(
            hour=settings.STAR_VALUATION_SCHEDULE_HOUR,
            minute=settings.STAR_VALUATION_SCHEDULE_MINUTE,
            second=0,
            microsecond=0,
        )
        if next_run <= now:
            next_run += timedelta(days=1)

        sleep_seconds = max(1.0, (next_run - now).total_seconds())
        logger.info(
            "Next daily star valuation run scheduled for %s",
            next_run.isoformat(),
        )
        await asyncio.sleep(sleep_seconds)

        try:
            await run_daily_valuation_job(target_date=next_run.date())
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Daily star valuation scheduler run failed.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler_task = None
    if settings.STAR_VALUATION_SCHEDULE_ENABLED:
        timezone = _scheduler_timezone()
        now = datetime.now(timezone)
        scheduled_today = now.replace(
            hour=settings.STAR_VALUATION_SCHEDULE_HOUR,
            minute=settings.STAR_VALUATION_SCHEDULE_MINUTE,
            second=0,
            microsecond=0,
        )
        if now >= scheduled_today:
            try:
                await run_daily_valuation_job(target_date=now.date())
            except Exception:
                logger.exception("Startup catch-up for daily star valuation failed.")
        scheduler_task = asyncio.create_task(_daily_valuation_scheduler_loop())

    try:
        yield
    finally:
        if scheduler_task is not None:
            scheduler_task.cancel()
            with suppress(asyncio.CancelledError):
                await scheduler_task

app = FastAPI(title="Aster Atlas API", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.v1.api import api_router

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Welcome to Aster Atlas API"}
