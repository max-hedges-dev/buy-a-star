#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import datetime as dt
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.services.valuation_jobs import run_daily_valuation_job


async def main() -> None:
    summary = await run_daily_valuation_job(target_date=dt.date.today())
    print(summary)


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
