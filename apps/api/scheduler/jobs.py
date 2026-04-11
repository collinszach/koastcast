"""
APScheduler Job Definitions

Registers all background jobs onto the scheduler instance.
Jobs run on the NUC and are not exposed to the internet.
"""
from __future__ import annotations

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from services.ndbc import BUOYS_OF_INTEREST, fetch_buoy_spectral, fetch_buoy_stdmet
from db.supabase_client import get_spots, upsert_buoy_observations, upsert_spot_forecasts
from services.open_meteo import align_wind_to_marine, fetch_marine_forecast, fetch_wind_forecast
from services.bias_correction import SpotBiasCorrector, compute_angle_diff

logger = structlog.get_logger(__name__)


def register_jobs(scheduler: AsyncIOScheduler) -> None:
    """Register all background jobs on the provided scheduler."""
    scheduler.add_job(
        update_buoy_data,
        trigger=CronTrigger(minute=30),  # every hour at :30 — NDBC data lands ~20-25min past
        id="update_buoy_data",
        name="Fetch all NDBC buoy data",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300,
    )

    scheduler.add_job(
        update_forecasts,
        trigger=CronTrigger(hour="*/3", minute=0),  # 3h cadence: 0,3,6,9,12,15,18,21 UTC
        id="update_forecasts",
        name="Fetch and assemble spot forecasts",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=600,
    )

    scheduler.add_job(
        send_optimal_window_notifications,
        trigger=CronTrigger(hour=18, minute=0),  # daily at 6pm UTC
        id="send_optimal_notifications",
        name="Send optimal window push notifications",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600,
    )

    scheduler.add_job(
        validate_forecast_accuracy,
        trigger=CronTrigger(hour=4, minute=0),  # daily at 4am UTC
        id="validate_forecast_accuracy",
        name="Compare yesterday forecasts vs buoy observations",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600,
    )

    scheduler.add_job(
        check_buoy_health,
        trigger=CronTrigger(minute=45),  # every hour after buoy fetch
        id="check_buoy_health",
        name="Alert if any buoy has been offline >6h",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=600,
    )

    scheduler.add_job(
        nightly_model_refresh,
        trigger=CronTrigger(hour=3, minute=0),  # daily at 3am UTC
        id="nightly_model_refresh",
        name="Retrain ML models if enough new session data",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=3600,
    )

    logger.info(
        "Registered scheduler jobs",
        jobs=[
            "update_buoy_data",
            "update_forecasts",
            "send_optimal_notifications",
            "validate_forecast_accuracy",
            "check_buoy_health",
            "nightly_model_refresh",
        ],
    )


async def update_buoy_data() -> None:
    """
    Fetch latest data from all NDBC buoys and upsert into Supabase.
    Runs every hour at :30.
    """
    log = logger.bind(job="update_buoy_data")
    log.info("Starting buoy data update", stations=len(BUOYS_OF_INTEREST))

    success_count = 0
    error_count = 0

    for station_id in BUOYS_OF_INTEREST:
        try:
            # Fetch stdmet and spectral data concurrently
            import asyncio
            stdmet_task = asyncio.create_task(fetch_buoy_stdmet(station_id))
            spectral_task = asyncio.create_task(fetch_buoy_spectral(station_id))
            df, spectral = await asyncio.gather(stdmet_task, spectral_task, return_exceptions=True)

            # Handle individual failures gracefully
            if isinstance(df, Exception):
                log.warning("stdmet fetch failed", station_id=station_id,
                            error=repr(df), exc_type=type(df).__name__)
                df = None
            if isinstance(spectral, Exception):
                log.warning("spectral fetch failed", station_id=station_id,
                            error=repr(spectral), exc_type=type(spectral).__name__)
                spectral = {}

            if df is not None and not df.empty:
                count = await upsert_buoy_observations(station_id, df, spectral or {})
                log.info("Buoy updated", station_id=station_id, rows=count)
                success_count += 1
            else:
                log.warning("No stdmet data", station_id=station_id)

        except Exception as exc:
            log.error("Buoy update failed", station_id=station_id, error=str(exc))
            error_count += 1

    log.info(
        "Buoy update complete",
        success=success_count,
        errors=error_count,
        total=len(BUOYS_OF_INTEREST),
    )


async def update_forecasts() -> None:
    """
    Fetch fresh forecast data from Open-Meteo and assemble per-spot forecasts.
    Runs every 6 hours (1am, 7am, 1pm, 7pm UTC).
    """
    log = logger.bind(job="update_forecasts")
    log.info("Starting forecast update")

    try:
        spots = await get_spots()
    except Exception as exc:
        log.error("Failed to load spots", error=str(exc))
        return

    log.info("Processing spots", count=len(spots))
    success_count = 0
    error_count = 0

    for spot in spots:
        try:
            import asyncio
            marine_task = asyncio.create_task(fetch_marine_forecast(spot.lat, spot.lng, days=16))
            wind_task = asyncio.create_task(fetch_wind_forecast(spot.lat, spot.lng, days=16))
            marine, wind = await asyncio.gather(marine_task, wind_task)

            merged = align_wind_to_marine(marine, wind)
            corrector = SpotBiasCorrector(str(spot.id) if spot.id else spot.slug)

            records = _build_forecast_records(merged, spot, corrector)

            if records and spot.id:
                await upsert_spot_forecasts(str(spot.id), records)
                log.info("Forecast updated", spot=spot.slug, hours=len(records))
                success_count += 1

        except Exception as exc:
            log.error("Forecast update failed", spot=spot.slug, error=str(exc))
            error_count += 1

    log.info("Forecast update complete", success=success_count, errors=error_count)


async def send_optimal_window_notifications() -> None:
    """
    Daily at 6pm: find optimal surf windows starting in the next 18 hours.
    Send push notifications to users who have those spots in their home_spots.
    Respects per-user notification preferences.
    """
    log = logger.bind(job="send_optimal_notifications")
    log.info("Checking for optimal windows to notify")

    try:
        from datetime import datetime, timezone, timedelta
        from services.optimal_windows import find_optimal_windows
        from services.stoke_score import DEFAULT_PREFERENCES

        spots = await get_spots()
        now = datetime.now(timezone.utc)
        notify_before = now + timedelta(hours=18)

        for spot in spots:
            try:
                import asyncio
                marine = await fetch_marine_forecast(spot.lat, spot.lng, days=2)
                wind = await fetch_wind_forecast(spot.lat, spot.lng, days=2)
                merged = align_wind_to_marine(marine, wind)

                corrector = SpotBiasCorrector(str(spot.id) if spot.id else spot.slug)
                records = _build_forecast_records(merged, spot, corrector)

                windows = find_optimal_windows(
                    forecast_hours=records,
                    spot=spot,
                    prefs=DEFAULT_PREFERENCES,
                    min_score=65.0,
                )

                # Find windows starting within 18h
                upcoming = [
                    w for w in windows
                    if isinstance(w.start_time, datetime)
                    and now <= w.start_time <= notify_before
                ]

                if not upcoming:
                    continue

                best = upcoming[0]
                log.info(
                    "Optimal window found",
                    spot=spot.slug,
                    score=best.peak_score,
                    start=best.start_time.isoformat(),
                )

                # TODO: fetch users with this spot in home_spots and send push
                # Placeholder — push notification delivery via Supabase edge function
                # (wired up when service worker + VAPID keys are configured)

            except Exception as exc:
                log.warning("Notification check failed for spot", spot=spot.slug, error=str(exc))

    except Exception as exc:
        log.error("Notification job failed", error=str(exc))


async def validate_forecast_accuracy() -> None:
    """
    Daily at 4am: compare yesterday's forecasts against actual buoy observations.
    Logs MAE/RMSE per spot+model to forecast_accuracy table.
    """
    log = logger.bind(job="validate_forecast_accuracy")
    log.info("Starting forecast accuracy validation")

    try:
        from datetime import datetime, timezone, timedelta
        client = get_client()

        yesterday_start = (datetime.now(timezone.utc) - timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        yesterday_end = yesterday_start + timedelta(days=1)

        # Fetch all spots
        spots = await get_spots()

        for spot in spots:
            if not spot.nearest_buoy_id or not spot.id:
                continue
            try:
                # Get forecasts for yesterday
                result = await client.table("spot_forecasts") \
                    .select("forecast_time, wave_height_face_m, model_source") \
                    .eq("spot_id", str(spot.id)) \
                    .gte("forecast_time", yesterday_start.isoformat()) \
                    .lt("forecast_time", yesterday_end.isoformat()) \
                    .execute()
                forecasts = result.data or []

                # Get buoy observations for same window
                obs_result = await client.table("buoy_observations") \
                    .select("observed_at, wvht") \
                    .eq("station_id", spot.nearest_buoy_id) \
                    .gte("observed_at", yesterday_start.isoformat()) \
                    .lt("observed_at", yesterday_end.isoformat()) \
                    .execute()
                observations = {o["observed_at"][:13]: o["wvht"] for o in (obs_result.data or []) if o.get("wvht")}

                if not observations:
                    continue

                # Match forecasts to nearest buoy observation
                records = []
                for f in forecasts:
                    hour_key = f["forecast_time"][:13]
                    obs_hs = observations.get(hour_key)
                    pred = f.get("wave_height_face_m")
                    if obs_hs is None or pred is None:
                        continue

                    # Forecast lead: compare when forecast was generated vs valid time
                    mae = abs(pred - obs_hs)
                    records.append({
                        "spot_id": str(spot.id),
                        "model_source": f["model_source"],
                        "forecast_for": f["forecast_time"],
                        "forecasted_at": yesterday_start.isoformat(),
                        "lead_hours": 6,  # approximate
                        "predicted_height_m": pred,
                        "observed_height_m": obs_hs,
                        "mae": mae,
                        "rmse": mae,  # single-point RMSE = MAE
                    })

                if records:
                    await client.table("forecast_accuracy").upsert(records).execute()
                    log.info("Accuracy logged", spot=spot.slug, records=len(records))

            except Exception as exc:
                log.warning("Accuracy check failed for spot", spot=spot.slug, error=str(exc))

    except Exception as exc:
        log.error("Forecast accuracy job failed", error=str(exc))


async def check_buoy_health() -> None:
    """
    Every hour: check if any buoy has been offline (no data) for >6 hours.
    Logs a warning — future version sends alert email/Slack.
    """
    log = logger.bind(job="check_buoy_health")

    try:
        from datetime import datetime, timezone, timedelta
        client = get_client()

        cutoff = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
        offline = []

        for station_id in BUOYS_OF_INTEREST:
            result = await client.table("buoy_observations") \
                .select("observed_at") \
                .eq("station_id", station_id) \
                .gte("observed_at", cutoff) \
                .limit(1) \
                .execute()

            if not result.data:
                offline.append(station_id)
                log.warning("Buoy offline >6h", station_id=station_id)

        if offline:
            log.error(
                "BUOY HEALTH ALERT — stations offline >6h",
                offline_stations=offline,
                count=len(offline),
            )
            # TODO: send Slack/email alert when configured
        else:
            log.info("All buoys healthy", checked=len(BUOYS_OF_INTEREST))

    except Exception as exc:
        log.error("Buoy health check failed", error=str(exc))


async def nightly_model_refresh() -> None:
    """
    Daily at 3am: retrain stoke/crowd models if >50 new session labels since last run.
    Skips retraining if not enough data — models stay stable.
    """
    log = logger.bind(job="nightly_model_refresh")
    log.info("Checking if models need retraining")

    try:
        from datetime import datetime, timezone, timedelta
        client = get_client()

        # Count sessions in last 30 days with quality ratings
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        result = await client.table("user_sessions") \
            .select("id", count="exact") \
            .gte("created_at", cutoff) \
            .not_.is_("quality_rating", "null") \
            .execute()

        session_count = result.count or 0
        log.info("New labeled sessions (30d)", count=session_count)

        if session_count < 50:
            log.info("Not enough data for retraining — skipping", min_required=50)
            return

        # Trigger retraining as subprocess (keeps scheduler non-blocking)
        import asyncio
        proc = await asyncio.create_subprocess_exec(
            "uv", "run", "python", "-m", "ml.train_stoke_model",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)

        if proc.returncode == 0:
            log.info("Stoke model retrained successfully")
        else:
            log.error("Stoke model retraining failed", stderr=stderr.decode()[:300])

        # Check bias correction model freshness
        import time
        from pathlib import Path
        models_dir = Path(__file__).parent.parent / "models" / "ml"
        bias_models = list(models_dir.glob("bias_*.pkl"))
        if bias_models:
            now_ts = time.time()
            stale = [
                mf for mf in bias_models
                if (now_ts - mf.stat().st_mtime) / 86400 > 90
            ]
            for mf in stale:
                age_days = round((now_ts - mf.stat().st_mtime) / 86400)
                log.warning(
                    "Bias correction model is stale — run ml/train_bias_correction.py",
                    model=mf.name,
                    age_days=age_days,
                )
            if not stale:
                log.info("All bias correction models are fresh", count=len(bias_models))
        else:
            log.info("No bias correction models found", path=str(models_dir))

    except Exception as exc:
        log.error("Nightly model refresh failed", error=str(exc))


def get_client():
    """Lazily import Supabase client to avoid circular imports."""
    from db.supabase_client import get_client as _get_client
    return _get_client()


def _build_forecast_records(
    merged: dict,
    spot,
    corrector: SpotBiasCorrector,
) -> list[dict]:
    """Build forecast DB records from merged Open-Meteo data."""
    from datetime import datetime, timezone
    records = []
    timestamps = merged.get("timestamps", [])

    for i, ts_str in enumerate(timestamps):
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
        except ValueError:
            continue

        wave_h = _safe_get(merged, "wave_height", i)
        wave_p = _safe_get(merged, "wave_period", i)
        swell_d = _safe_get(merged, "swell_wave_direction", i)

        face_h = None
        confidence = None
        if wave_h is not None and wave_p is not None:
            swell_dir = swell_d or _safe_get(merged, "wave_direction", i) or 270.0
            optimal_dir = spot.optimal_swell_direction or 270.0
            angle_diff = compute_angle_diff(swell_dir, optimal_dir)
            face_h, confidence = corrector.predict(
                buoy_hs=wave_h,
                buoy_tp=wave_p,
                buoy_dir=swell_dir,
                swell_angle_diff=angle_diff,
                doy=ts.timetuple().tm_yday,
            )

        records.append({
            "forecast_time": ts.isoformat(),
            "model_source": "open_meteo",
            "wave_height_m": wave_h,
            "wave_height_face_m": face_h,
            "wave_period_s": wave_p,
            "wave_direction": _safe_get(merged, "wave_direction", i),
            "swell_height_m": _safe_get(merged, "swell_wave_height", i),
            "swell_period_s": _safe_get(merged, "swell_wave_period", i),
            "swell_direction": swell_d,
            "wind_swell_height_m": _safe_get(merged, "wind_wave_height", i),
            "wind_swell_period_s": _safe_get(merged, "wind_wave_period", i),
            "wind_swell_direction": _safe_get(merged, "wind_wave_direction", i),
            "wind_speed_ms": _safe_get(merged, "wind_speed_ms", i),
            "wind_direction": _safe_get(merged, "wind_direction", i),
            "wind_gust_ms": _safe_get(merged, "wind_gust_ms", i),
            "confidence": confidence,
        })

    return records


def _safe_get(data: dict, key: str, idx: int) -> float | None:
    try:
        val = data[key][idx]
        return float(val) if val is not None else None
    except (KeyError, IndexError, TypeError, ValueError):
        return None
