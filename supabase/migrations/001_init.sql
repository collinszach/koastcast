-- ─────────────────────────────────────────────────────────────────────────
-- nSwell Database Migration 001: Core Schema
-- Run via: supabase db push
-- ─────────────────────────────────────────────────────────────────────────

-- Extensions must be enabled via Supabase dashboard (Database → Extensions):
--   postgis, vector, pg_cron

-- ─── Spots ────────────────────────────────────────────────────────────────
CREATE TABLE spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  region TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  break_type TEXT CHECK (break_type IN ('beach','reef','point','rivermouth','jetty')),
  optimal_swell_direction NUMERIC,
  optimal_swell_direction_range NUMERIC DEFAULT 45,
  optimal_wind_direction NUMERIC,
  optimal_period_min NUMERIC DEFAULT 10,
  optimal_period_max NUMERIC DEFAULT 20,
  optimal_size_min NUMERIC DEFAULT 1.5,
  optimal_size_max NUMERIC DEFAULT 3.0,
  nearest_buoy_id TEXT,
  secondary_buoy_id TEXT,
  swan_enabled BOOLEAN DEFAULT FALSE,
  bathymetry_file TEXT,
  timezone TEXT DEFAULT 'America/Los_Angeles',
  skill_minimum TEXT CHECK (skill_minimum IN ('beginner','intermediate','advanced','pro')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spots_location ON spots USING GIST (location);
CREATE INDEX idx_spots_slug ON spots (slug);
CREATE INDEX idx_spots_region ON spots (region);

-- ─── Buoy Observations ────────────────────────────────────────────────────
CREATE TABLE buoy_observations (
  station_id TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  -- Met data
  wvht NUMERIC,
  dpd  NUMERIC,
  apd  NUMERIC,
  mwd  NUMERIC,
  wspd NUMERIC,
  wdir NUMERIC,
  gst  NUMERIC,
  pres NUMERIC,
  atmp NUMERIC,
  wtmp NUMERIC,
  dewp NUMERIC,
  vis  NUMERIC,
  ptdy NUMERIC,
  tide NUMERIC,
  -- Swell components (from .spec summary)
  swh  NUMERIC,  -- swell height
  swp  NUMERIC,  -- swell period
  swd  NUMERIC,  -- swell direction
  wwh  NUMERIC,  -- wind wave height
  wwp  NUMERIC,  -- wind wave period
  wwd  NUMERIC,  -- wind wave direction
  -- Spectral energy bands (48 bands, 0.025-0.485 Hz)
  -- Stored as JSONB for flexibility: {"0.033": 1.23, "0.038": 2.45, ...}
  spectral_energy JSONB,
  spectral_direction JSONB,
  -- Metadata
  data_quality TEXT DEFAULT 'realtime' CHECK (data_quality IN ('realtime','delayed','historical')),
  PRIMARY KEY (station_id, observed_at)
);

CREATE INDEX idx_buoy_obs_station ON buoy_observations (station_id, observed_at DESC);
CREATE INDEX idx_buoy_obs_time ON buoy_observations (observed_at DESC);

-- ─── Spot Forecasts ───────────────────────────────────────────────────────
CREATE TABLE spot_forecasts (
  spot_id UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  forecast_time TIMESTAMPTZ NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_source TEXT NOT NULL,
  -- Wave
  wave_height_m NUMERIC,
  wave_height_face_m NUMERIC,
  wave_period_s NUMERIC,
  wave_direction NUMERIC,
  -- Swell separation
  swell_height_m NUMERIC,
  swell_period_s NUMERIC,
  swell_direction NUMERIC,
  wind_swell_height_m NUMERIC,
  wind_swell_period_s NUMERIC,
  wind_swell_direction NUMERIC,
  -- Wind
  wind_speed_ms NUMERIC,
  wind_direction NUMERIC,
  wind_gust_ms NUMERIC,
  -- Tide
  tide_height_m NUMERIC,
  tide_state TEXT CHECK (tide_state IN ('rising','falling','high','low')),
  -- Quality scores
  quality_score NUMERIC CHECK (quality_score BETWEEN 0 AND 10),
  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
  model_agreement NUMERIC CHECK (model_agreement BETWEEN 0 AND 1),
  -- Spectral data
  wave_spectrum JSONB,
  PRIMARY KEY (spot_id, forecast_time, model_source)
);

CREATE INDEX idx_forecast_spot_time ON spot_forecasts (spot_id, forecast_time DESC, model_source);
CREATE INDEX idx_forecast_time ON spot_forecasts (forecast_time DESC);

-- ─── User Sessions ────────────────────────────────────────────────────────
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id UUID NOT NULL REFERENCES spots(id),
  session_date DATE NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  -- Conditions at time (snapshotted from forecast/buoy)
  wave_height_face_m NUMERIC,
  wave_period_s NUMERIC,
  wave_direction NUMERIC,
  wind_speed_ms NUMERIC,
  wind_direction NUMERIC,
  tide_height_m NUMERIC,
  -- User ratings
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 10),
  crowd_rating INTEGER CHECK (crowd_rating BETWEEN 1 AND 5),
  notes TEXT,
  notes_embedding VECTOR(384),
  skill_tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON user_sessions (user_id, session_date DESC);
CREATE INDEX idx_sessions_spot ON user_sessions (spot_id, session_date DESC);
CREATE INDEX idx_sessions_embedding ON user_sessions USING ivfflat (notes_embedding vector_cosine_ops);

-- ─── User Profiles ────────────────────────────────────────────────────────
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  skill_level TEXT DEFAULT 'intermediate' CHECK (skill_level IN ('beginner','intermediate','advanced','pro')),
  board_type TEXT DEFAULT 'shortboard' CHECK (board_type IN ('shortboard','longboard','fish','funboard','SUP','bodyboard','other')),
  pref_min_height_m NUMERIC DEFAULT 0.6,
  pref_max_height_m NUMERIC DEFAULT 2.5,
  pref_min_period_s NUMERIC DEFAULT 8.0,
  pref_offshore_importance NUMERIC DEFAULT 0.8,
  pref_crowd_tolerance NUMERIC DEFAULT 0.5,
  home_spots UUID[] DEFAULT '{}',
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free','pro','explorer')),
  subscription_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  push_subscription JSONB,
  notification_prefs JSONB DEFAULT '{
    "optimal_windows": true,
    "swell_alerts": true,
    "crowd_alerts": false,
    "min_stoke_threshold": 65
  }'::jsonb,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── API Keys (B2B) ───────────────────────────────────────────────────────
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash TEXT UNIQUE NOT NULL,  -- bcrypt hash of actual key
  key_prefix TEXT NOT NULL,       -- first 8 chars for display: "sk_8f3a..."
  name TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  requests_this_month INTEGER DEFAULT 0,
  monthly_limit INTEGER DEFAULT 10000,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Crowd Observations ───────────────────────────────────────────────────
CREATE TABLE crowd_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES spots(id),
  user_id UUID REFERENCES auth.users(id),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  crowd_level INTEGER CHECK (crowd_level BETWEEN 1 AND 5),
  -- Automatically populated context
  day_of_week INTEGER,
  hour_of_day INTEGER,
  quality_score_at_time NUMERIC
);

-- ─── Forecast Accuracy Log ────────────────────────────────────────────────
CREATE TABLE forecast_accuracy (
  id BIGSERIAL PRIMARY KEY,
  spot_id UUID NOT NULL REFERENCES spots(id),
  model_source TEXT NOT NULL,
  forecast_for TIMESTAMPTZ NOT NULL,
  forecasted_at TIMESTAMPTZ NOT NULL,
  lead_hours INTEGER NOT NULL,
  predicted_height_m NUMERIC,
  observed_height_m NUMERIC,
  mae NUMERIC,
  rmse NUMERIC,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────────────────

-- Spots: public read
ALTER TABLE spots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Spots are publicly readable" ON spots FOR SELECT USING (true);

-- Buoy observations: public read
ALTER TABLE buoy_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buoy observations are publicly readable" ON buoy_observations FOR SELECT USING (true);

-- Spot forecasts: public read (gating is done at API level by lead time)
ALTER TABLE spot_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forecasts are publicly readable" ON spot_forecasts FOR SELECT USING (true);

-- User sessions: private to owner
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own sessions" ON user_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON user_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON user_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON user_sessions FOR DELETE USING (auth.uid() = user_id);

-- User profiles: private to owner
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- API keys: private to owner
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own API keys" ON api_keys FOR ALL USING (auth.uid() = user_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_sessions_updated_at
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- ─── Useful Views ─────────────────────────────────────────────────────────

-- Current conditions per spot (latest ensemble forecast)
CREATE VIEW current_conditions AS
SELECT DISTINCT ON (spot_id)
  s.id as spot_id,
  s.name,
  s.slug,
  s.region,
  ST_X(s.location::geometry) as lng,
  ST_Y(s.location::geometry) as lat,
  f.wave_height_face_m,
  f.wave_period_s,
  f.wave_direction,
  f.wind_speed_ms,
  f.wind_direction,
  f.tide_height_m,
  f.tide_state,
  f.quality_score,
  f.forecast_time,
  f.model_source
FROM spots s
LEFT JOIN spot_forecasts f ON f.spot_id = s.id
  AND f.forecast_time >= NOW() - INTERVAL '1 hour'
  AND f.forecast_time <= NOW() + INTERVAL '1 hour'
  AND f.model_source = 'ensemble'
ORDER BY s.id, f.forecast_time DESC;

-- Spot leaderboard (best conditions right now)
CREATE VIEW spot_leaderboard AS
SELECT 
  slug, name, region, lat, lng,
  wave_height_face_m,
  wave_period_s,
  quality_score,
  CASE
    WHEN quality_score >= 8 THEN 'firing'
    WHEN quality_score >= 6 THEN 'pumping'
    WHEN quality_score >= 4 THEN 'fun'
    WHEN quality_score >= 2 THEN 'worth_it'
    ELSE 'flat'
  END as condition_label
FROM current_conditions
WHERE quality_score IS NOT NULL
ORDER BY quality_score DESC;
