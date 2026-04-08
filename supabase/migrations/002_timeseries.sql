-- Migration 002: Materialized Rollup Views
-- Replaces TimescaleDB continuous aggregates with standard Postgres materialized views.
-- Refreshed by the API scheduler (nightly_model_refresh job).

-- ─── Hourly buoy rollup ───────────────────────────────────────────────────
CREATE MATERIALIZED VIEW buoy_hourly AS
SELECT
  station_id,
  date_trunc('hour', observed_at) AS bucket,
  AVG(wvht) AS avg_wvht,
  MAX(wvht) AS max_wvht,
  AVG(dpd)  AS avg_dpd,
  AVG(mwd)  AS avg_mwd,
  AVG(wspd) AS avg_wspd,
  AVG(wdir) AS avg_wdir,
  AVG(wtmp) AS avg_wtmp,
  COUNT(*)  AS obs_count
FROM buoy_observations
GROUP BY station_id, date_trunc('hour', observed_at)
WITH NO DATA;

CREATE UNIQUE INDEX idx_buoy_hourly ON buoy_hourly (station_id, bucket);

-- ─── Daily buoy rollup ────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW buoy_daily AS
SELECT
  station_id,
  date_trunc('day', observed_at) AS bucket,
  AVG(wvht) AS avg_wvht,
  MAX(wvht) AS max_wvht,
  MIN(wvht) AS min_wvht,
  AVG(dpd)  AS avg_dpd,
  AVG(wspd) AS avg_wspd,
  AVG(wtmp) AS avg_wtmp,
  COUNT(*)  AS obs_count
FROM buoy_observations
GROUP BY station_id, date_trunc('day', observed_at)
WITH NO DATA;

CREATE UNIQUE INDEX idx_buoy_daily ON buoy_daily (station_id, bucket);

-- ─── Daily forecast quality rollup ───────────────────────────────────────
CREATE MATERIALIZED VIEW forecast_daily AS
SELECT
  spot_id,
  model_source,
  date_trunc('day', forecast_time) AS bucket,
  AVG(quality_score)      AS avg_quality,
  MAX(quality_score)      AS max_quality,
  AVG(wave_height_face_m) AS avg_wave_height,
  MAX(wave_height_face_m) AS max_wave_height,
  AVG(wave_period_s)      AS avg_period,
  AVG(wind_speed_ms)      AS avg_wind_speed,
  AVG(model_agreement)    AS avg_agreement,
  COUNT(*)                AS hour_count
FROM spot_forecasts
GROUP BY spot_id, model_source, date_trunc('day', forecast_time)
WITH NO DATA;

CREATE UNIQUE INDEX idx_forecast_daily ON forecast_daily (spot_id, model_source, bucket);

-- ─── Refresh helper function ──────────────────────────────────────────────
-- Call this from the API scheduler instead of TimescaleDB refresh policies.
-- Usage: SELECT refresh_rollups();
CREATE OR REPLACE FUNCTION refresh_rollups()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY buoy_hourly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY buoy_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY forecast_daily;
END;
$$;
