-- ============================================================================
-- 048 — Sevens tournaments
-- ============================================================================
-- A sevens tournament is a multi-game competition run over (usually) two days:
--   Day 1 — 3 group-stage games
--   Day 2 — 3 knockout games along one of two brackets:
--            • Cup       (finished top-2 in the group)
--            • Challenger (finished below top-2)
--           …with placement playoffs filling the day if you drop out early.
--
-- We DON'T model other teams or full standings — the app is club-centric, so
-- the manager marks their own outcomes and the system guides the path.
--
-- Each individual game stays an ordinary row in `matches`, so per-player
-- `match_stats`, squad selection (`fixture_team_selections`) and the CSV/Excel
-- stat import all keep working per game unchanged. `tournaments` is just a
-- parent container, and new columns on `matches` link each game to it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. tournaments — the parent container
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  venue TEXT,
  day1_date DATE NOT NULL,
  day2_date DATE,                       -- NULL for single-day tournaments
  format TEXT NOT NULL DEFAULT 'sevens',
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'in_progress', 'completed')),
  -- Which day-2 bracket the club landed in, once the manager marks the group
  -- finish. NULL until the group stage outcome is set.
  group_outcome TEXT CHECK (group_outcome IN ('cup', 'challenger')),
  -- Free-text final result, e.g. "Cup Winners", "Challenger Runners-up", "5th".
  final_placement TEXT,
  created_by UUID REFERENCES user_profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_day1 ON tournaments(day1_date);

-- ----------------------------------------------------------------------------
-- 2. tournament_squad — the single shared squad for the whole tournament
-- ----------------------------------------------------------------------------
-- Sevens squads stay stable across a weekend, so the squad is picked once and
-- applies to every game. (We also copy it into fixture_team_selections per
-- game so the existing stats/selection screens keep working unchanged.)
CREATE TABLE IF NOT EXISTS tournament_squad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES players(user_id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_squad_tournament ON tournament_squad(tournament_id);

-- ----------------------------------------------------------------------------
-- 3. Link each game (a `matches` row) to its tournament + stage
-- ----------------------------------------------------------------------------
ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_id UUID
  REFERENCES tournaments(id) ON DELETE CASCADE;
-- group | quarter | semi | final | placement
ALTER TABLE matches ADD COLUMN IF NOT EXISTS stage TEXT;
-- cup | challenger | placement (NULL for group games)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bracket TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS day_number INTEGER;   -- 1 or 2
ALTER TABLE matches ADD COLUMN IF NOT EXISTS game_order INTEGER;   -- 1..6

CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);

-- ----------------------------------------------------------------------------
-- 4. Row Level Security — mirror the `matches` policy set
-- ----------------------------------------------------------------------------
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_squad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view tournaments" ON tournaments;
CREATE POLICY "Everyone can view tournaments"
  ON tournaments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Data admins and admins can manage tournaments" ON tournaments;
CREATE POLICY "Data admins and admins can manage tournaments"
  ON tournaments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'data_admin')
    )
  );

DROP POLICY IF EXISTS "Everyone can view tournament squad" ON tournament_squad;
CREATE POLICY "Everyone can view tournament squad"
  ON tournament_squad FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Data admins and admins can manage tournament squad" ON tournament_squad;
CREATE POLICY "Data admins and admins can manage tournament squad"
  ON tournament_squad FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'data_admin')
    )
  );

-- Note: all writes from the app go through service-role API routes anyway
-- (which bypass RLS), so these policies mainly govern direct client reads.
