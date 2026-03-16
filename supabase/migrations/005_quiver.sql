-- ============================================================
-- Migration 005: Quiver Manager
-- Board and wetsuit tracking with gear performance analytics
-- ============================================================

-- ─── Boards table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Board identity
  name TEXT NOT NULL,                 -- e.g. "my step-up", "the fish", "old longboard"
  brand TEXT,                         -- e.g. "Channel Islands", "Pyzel"
  model TEXT,                         -- e.g. "Happy", "Ghost"
  -- Dimensions
  length_ft NUMERIC,                  -- feet (e.g. 6.2)
  width_in NUMERIC,                   -- inches (e.g. 20.5)
  thickness_in NUMERIC,               -- inches (e.g. 2.75)
  volume_L NUMERIC,                   -- liters (e.g. 34.5)
  -- Board type
  board_type TEXT CHECK (board_type IN (
    'shortboard','longboard','fish','funboard','egg','gun','SUP','bodyboard','foil','other'
  )),
  fin_setup TEXT CHECK (fin_setup IN ('single','twin','thruster','quad','five','2+1','other')),
  -- Condition preferences (user can optionally fill in)
  best_wave_min_ft NUMERIC,           -- ideal min wave height in feet
  best_wave_max_ft NUMERIC,           -- ideal max wave height in feet
  best_period_min_s NUMERIC,          -- ideal min period
  notes TEXT,
  -- Status
  active BOOLEAN DEFAULT TRUE,        -- false = retired/sold
  primary_board BOOLEAN DEFAULT FALSE,-- one board per user can be primary
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Wetsuits table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wetsuits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                 -- e.g. "4/3 winter suit", "spring suit"
  brand TEXT,
  -- Thickness (determines temp range)
  thickness TEXT NOT NULL,            -- e.g. "4/3", "3/2", "2/2", "5/4/3", "spring"
  temp_min_f NUMERIC,                 -- min comfortable water temp (°F)
  temp_max_f NUMERIC,                 -- max comfortable water temp (°F)
  -- Accessories
  booties BOOLEAN DEFAULT FALSE,
  gloves BOOLEAN DEFAULT FALSE,
  hood BOOLEAN DEFAULT FALSE,
  -- Status
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Gear performance log ────────────────────────────────────────────────────
-- Links sessions to the gear used — enables board performance analytics
CREATE TABLE IF NOT EXISTS session_gear (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board_id UUID REFERENCES boards(id) ON DELETE SET NULL,
  wetsuit_id UUID REFERENCES wetsuits(id) ON DELETE SET NULL,
  -- Gear performance rating for this session
  board_rating INTEGER CHECK (board_rating BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_boards_user ON boards(user_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_wetsuits_user ON wetsuits(user_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_session_gear_session ON session_gear(session_id);
CREATE INDEX IF NOT EXISTS idx_session_gear_board ON session_gear(board_id);

-- ─── RLS policies ─────────────────────────────────────────────────────────────
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE wetsuits ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_gear ENABLE ROW LEVEL SECURITY;

-- Boards: users can only see and modify their own boards
CREATE POLICY "Users manage their own boards"
  ON boards FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Wetsuits: users can only see and modify their own wetsuits
CREATE POLICY "Users manage their own wetsuits"
  ON wetsuits FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Session gear: users can only see and modify their own session gear
CREATE POLICY "Users manage their own session gear"
  ON session_gear FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_boards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boards_updated_at
  BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION update_boards_updated_at();
