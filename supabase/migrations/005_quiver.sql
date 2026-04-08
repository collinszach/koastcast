-- ============================================================
-- 005_quiver.sql — Board and wetsuit management
-- Re-runnable (IF NOT EXISTS throughout).
-- Column names match QuiverManager.tsx and GearRecommendation.tsx exactly.
-- ============================================================

-- ─── Boards table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS boards (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Identity
  name          TEXT    NOT NULL,          -- e.g. "my fish", "the step-up"
  brand         TEXT,                      -- e.g. "Channel Islands"
  model         TEXT,                      -- e.g. "Happy"
  -- Dimensions
  length_ft     NUMERIC,                   -- feet (e.g. 6.2)
  width_in      NUMERIC,                   -- inches (e.g. 20.5)
  thickness_in  NUMERIC,                   -- inches (e.g. 2.75)
  volume_L      NUMERIC,                   -- liters (e.g. 34.5)  ← capital L, matches component
  -- Classification
  board_type    TEXT CHECK (board_type IN (
                  'shortboard','longboard','fish','funboard','egg',
                  'gun','SUP','bodyboard','foil','other'
                )),                        -- matches BOARD_TYPES array in QuiverManager.tsx
  fin_setup     TEXT CHECK (fin_setup IN (
                  'single','twin','thruster','quad','five','2+1','other'
                )),
  -- Condition preferences
  best_wave_min_ft NUMERIC,               -- ideal min wave height in feet
  best_wave_max_ft NUMERIC,               -- ideal max wave height in feet
  best_period_min_s NUMERIC,
  notes         TEXT,
  -- Status
  active        BOOLEAN DEFAULT TRUE,      -- false = retired/sold
  primary_board BOOLEAN DEFAULT FALSE,     -- one primary board per user (enforced via partial unique index)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Wetsuits table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wetsuits (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,            -- e.g. "4/3 winter suit"
  brand       TEXT,
  -- Thickness: matches WETSUIT_THICKNESSES in QuiverManager.tsx
  thickness   TEXT    NOT NULL,            -- e.g. "4/3", "3/2", "spring", "boardshorts"
  temp_min_f  NUMERIC,                    -- min comfortable water temp (°F)
  temp_max_f  NUMERIC,                    -- max comfortable water temp (°F)
  -- Accessories — no "has_" prefix; matches component field names exactly
  booties     BOOLEAN DEFAULT FALSE,
  gloves      BOOLEAN DEFAULT FALSE,
  hood        BOOLEAN DEFAULT FALSE,
  -- Status
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Gear performance log ─────────────────────────────────────────────────────
-- Links sessions to gear used — enables board performance analytics
CREATE TABLE IF NOT EXISTS session_gear (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID    REFERENCES user_sessions(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board_id    UUID    REFERENCES boards(id) ON DELETE SET NULL,
  wetsuit_id  UUID    REFERENCES wetsuits(id) ON DELETE SET NULL,
  board_rating INTEGER CHECK (board_rating BETWEEN 1 AND 5),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_boards_user
  ON boards(user_id) WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_wetsuits_user
  ON wetsuits(user_id) WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_session_gear_session
  ON session_gear(session_id);

CREATE INDEX IF NOT EXISTS idx_session_gear_board
  ON session_gear(board_id);

-- One primary board per user (partial unique index, not a policy)
CREATE UNIQUE INDEX IF NOT EXISTS boards_one_primary_per_user
  ON boards(user_id)
  WHERE primary_board = TRUE AND active = TRUE;

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE boards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE wetsuits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_gear ENABLE ROW LEVEL SECURITY;

-- Postgres 15 supports CREATE POLICY IF NOT EXISTS
CREATE POLICY IF NOT EXISTS "boards_user_policy"
  ON boards FOR ALL TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "wetsuits_user_policy"
  ON wetsuits FOR ALL TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "session_gear_user_policy"
  ON session_gear FOR ALL TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── updated_at trigger on boards ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_boards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- DROP before CREATE so re-running is safe (triggers have no IF NOT EXISTS)
DROP TRIGGER IF EXISTS boards_updated_at ON boards;
CREATE TRIGGER boards_updated_at
  BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION update_boards_updated_at();
