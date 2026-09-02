-- ============================================================================
-- 051 — Coach ↔ Assistant Coach collaboration
-- ============================================================================
-- The Head Coach and Assistant Coach share the same permissions, so both can
-- create training sessions, record match-day attendance and pick a matchday
-- squad. Notifications (migration-free, see lib/notify-coaches.ts) already
-- tell the other one that something happened — but there was nowhere to
-- actually DISCUSS it, so the two could still silently disagree or overwrite
-- each other.
--
-- This adds a lightweight activity feed the coaching staff can collaborate
-- on in real time:
--
--   coach_activities   one row per notable coaching action (session created,
--                      attendance recorded, squad selected). This is a FEED
--                      record — it points back at the real entity via
--                      (kind, reference_id) and never duplicates its data.
--   activity_comments  threaded discussion on an activity. `parent_id` makes
--                      a reply; `stance` lets a coach explicitly SUPPORT or
--                      OBJECT rather than just leave a neutral comment.
--   activity_reactions one quick 👍 / 👎 per person per activity, for when a
--                      full comment is overkill.
--
-- All three are added to the `supabase_realtime` publication at the bottom so
-- the UI can subscribe and update live without polling.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. coach_activities — the feed
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coach_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who performed the action (a coach or assistant coach).
  actor_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE NOT NULL,
  -- What kind of action, and which record it refers to. Deliberately NOT a
  -- foreign key: reference_id points into different tables depending on kind
  -- (training_sessions vs matches), so integrity is enforced in the API.
  kind TEXT NOT NULL CHECK (kind IN ('training_session', 'match_attendance', 'team_selection')),
  reference_id UUID NOT NULL,
  -- Denormalised display copy so the feed renders without N+1 lookups into
  -- matches/training_sessions (and still reads correctly if the underlying
  -- fixture is later renamed or deleted).
  title TEXT NOT NULL,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- One feed entry per action per record: re-saving the same squad updates
  -- the existing row instead of spamming the feed with duplicates.
  UNIQUE(kind, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_activities_created ON coach_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_activities_actor ON coach_activities(actor_id);

-- ----------------------------------------------------------------------------
-- 2. activity_comments — threaded discussion
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES coach_activities(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE NOT NULL,
  -- NULL = top-level comment; set = a reply to that comment. Only one level
  -- of nesting is rendered, so replies to replies still hang off the root.
  parent_id UUID REFERENCES activity_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  -- 'object' is the important one: it lets an assistant formally flag
  -- disagreement with a selection/session so it stands out in the UI rather
  -- than being buried in prose.
  stance TEXT NOT NULL DEFAULT 'comment' CHECK (stance IN ('comment', 'support', 'object')),
  edited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_comments_activity ON activity_comments(activity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_comments_parent ON activity_comments(parent_id);

-- ----------------------------------------------------------------------------
-- 3. activity_reactions — quick like / object
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES coach_activities(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('like', 'object')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- One reaction per person per activity — reacting again flips or clears it.
  UNIQUE(activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_reactions_activity ON activity_reactions(activity_id);

-- ----------------------------------------------------------------------------
-- 4. Row Level Security
-- ----------------------------------------------------------------------------
-- Writes all go through service-role API routes (which enforce the coaching
-- roles), so these policies mainly govern the client's direct SELECT reads
-- and the Realtime subscription.
ALTER TABLE coach_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_reactions ENABLE ROW LEVEL SECURITY;

-- Coaching + management staff can read the feed and the discussion.
DROP POLICY IF EXISTS "Coaching staff can view activities" ON coach_activities;
CREATE POLICY "Coaching staff can view activities"
  ON coach_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('coach', 'asst_coach', 'admin', 'data_admin')
    )
  );

DROP POLICY IF EXISTS "Coaching staff can view comments" ON activity_comments;
CREATE POLICY "Coaching staff can view comments"
  ON activity_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('coach', 'asst_coach', 'admin', 'data_admin')
    )
  );

DROP POLICY IF EXISTS "Coaching staff can view reactions" ON activity_reactions;
CREATE POLICY "Coaching staff can view reactions"
  ON activity_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('coach', 'asst_coach', 'admin', 'data_admin')
    )
  );

-- ----------------------------------------------------------------------------
-- 5. Realtime — so the feed updates live for whoever else is looking at it
-- ----------------------------------------------------------------------------
-- Wrapped in DO blocks because adding a table that's already in the
-- publication raises, which would abort a re-run of this migration.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE coach_activities;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE activity_comments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE activity_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
