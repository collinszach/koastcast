-- Migration 003: ML Feature Tables
-- Stores model training run metadata and per-spot accuracy tracking.
-- Used by the nightly retraining job and the admin dashboard.

-- ─── Model Training Runs ─────────────────────────────────────────────────

CREATE TABLE model_training_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type TEXT NOT NULL CHECK (model_type IN ('bias_correction','stoke','crowd')),
  spot_id UUID REFERENCES spots(id),  -- NULL = global model
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','completed','failed')),
  -- Training data stats
  train_samples INTEGER,
  test_samples INTEGER,
  date_range_start DATE,
  date_range_end DATE,
  -- Accuracy metrics
  mae NUMERIC,     -- mean absolute error
  rmse NUMERIC,    -- root mean squared error
  r2 NUMERIC,      -- R² score
  -- Model artifact
  model_path TEXT, -- relative path to .pkl file
  feature_importance JSONB,
  hyperparams JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_training_runs_type_spot
  ON model_training_runs (model_type, spot_id, started_at DESC);

-- ─── Forecast Accuracy Tracking ──────────────────────────────────────────
-- Already have forecast_accuracy in 001; this adds a summary view.

CREATE VIEW model_accuracy_summary AS
SELECT
  model_source,
  spot_id,
  COUNT(*) AS verified_forecasts,
  AVG(mae)  AS avg_mae_m,
  AVG(rmse) AS avg_rmse_m,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mae) AS median_mae_m,
  MIN(forecasted_at) AS earliest_forecast,
  MAX(forecasted_at) AS latest_forecast
FROM forecast_accuracy
WHERE lead_hours <= 48   -- focus on short-range accuracy
GROUP BY model_source, spot_id
ORDER BY avg_mae_m ASC;

-- ─── Session-derived Training Labels ─────────────────────────────────────
-- View joining user session ratings with concurrent forecast conditions.
-- Used as training labels for the stoke and crowd models.

CREATE VIEW session_training_labels AS
SELECT
  us.id AS session_id,
  us.spot_id,
  us.session_date,
  us.quality_rating,
  us.crowd_rating,
  us.wave_height_face_m AS reported_height_m,
  us.wave_period_s      AS reported_period_s,
  -- Nearest forecast at session time
  sf.wave_height_face_m AS forecast_height_m,
  sf.wave_period_s      AS forecast_period_s,
  sf.wind_speed_ms      AS forecast_wind_ms,
  sf.wind_direction     AS forecast_wind_dir,
  sf.tide_height_m      AS forecast_tide_m,
  sf.quality_score      AS forecast_quality,
  -- Derived error (how wrong was the forecast?)
  ABS(COALESCE(us.wave_height_face_m, sf.wave_height_face_m) - sf.wave_height_face_m) AS height_error_m,
  -- Label for stoke model training
  us.quality_rating::NUMERIC / 10.0 AS stoke_label,   -- 0-1
  (6 - us.crowd_rating)::NUMERIC / 5.0 AS crowd_label -- inverted (5=packed → 0 score)
FROM user_sessions us
LEFT JOIN LATERAL (
  SELECT *
  FROM spot_forecasts sf
  WHERE sf.spot_id = us.spot_id
    AND sf.model_source = 'ensemble'
    AND sf.forecast_time BETWEEN
        COALESCE(us.start_time, us.session_date::timestamptz)
        AND COALESCE(us.start_time, us.session_date::timestamptz) + INTERVAL '2 hours'
  ORDER BY sf.forecast_time
  LIMIT 1
) sf ON TRUE
WHERE us.quality_rating IS NOT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE model_training_runs ENABLE ROW LEVEL SECURITY;

-- Training runs readable by all authenticated users (for transparency dashboard)
CREATE POLICY "Training runs publicly readable"
  ON model_training_runs FOR SELECT USING (true);

-- Only service role can insert/update (backend only)
