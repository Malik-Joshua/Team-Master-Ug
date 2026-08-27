-- ============================================================================
-- 049 — Player cards + per-user hidden match summaries
-- ============================================================================
-- Two additions:
--
-- 1) match_stats.yellow_card / match_stats.red_card — when the manager enters
--    a player's match statistics, they can mark that player as having been
--    shown a yellow or a red card during the game. Modeled as two independent
--    booleans (a player who receives a second yellow → red typically gets both
--    recorded), even though the UI will treat them as mutually exclusive.
--
-- 2) hidden_match_summaries — the Match Summaries screen can get noisy after
--    a full season, so any user can hide summaries from their own view. This
--    is a soft hide (no data is lost): the underlying match, stats, and squad
--    selection all stay intact for other users, reports, and player histories.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Card columns on match_stats
-- ----------------------------------------------------------------------------
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS yellow_card BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE match_stats ADD COLUMN IF NOT EXISTS red_card    BOOLEAN NOT NULL DEFAULT FALSE;

-- Helpful for the "who got carded this season" style lookups.
CREATE INDEX IF NOT EXISTS idx_match_stats_yellow_card ON match_stats(match_id) WHERE yellow_card;
CREATE INDEX IF NOT EXISTS idx_match_stats_red_card    ON match_stats(match_id) WHERE red_card;

-- ----------------------------------------------------------------------------
-- 2. Per-user hidden match summaries (soft archive)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hidden_match_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE NOT NULL,
  match_id UUID REFERENCES matches(id)            ON DELETE CASCADE NOT NULL,
  hidden_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_hidden_match_summaries_user ON hidden_match_summaries(user_id);

ALTER TABLE hidden_match_summaries ENABLE ROW LEVEL SECURITY;

-- A user can see, add, or remove ONLY their own hides. This is a purely
-- personal preference — no admin needs to peek at other users' hidden lists.
DROP POLICY IF EXISTS "Users manage their own hidden summaries" ON hidden_match_summaries;
CREATE POLICY "Users manage their own hidden summaries"
  ON hidden_match_summaries FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
