-- Let a team manager register a fixture with a tournament type that isn't in
-- the preset dropdown (e.g. a one-off invitational), and record how many
-- players are allowed in the matchday squad for that fixture.
--
-- The squad_size is used by the coach's team-selection screen and the "view
-- selected team" pitch to switch between a standard 15s layout (23-player
-- squad, 15 on the field) and a compact format like Sevens (12-player squad,
-- 7 on the field). tournament_type = 'sevens' always forces the compact
-- format regardless of squad_size.

-- Allow any tournament type text, not just the 4 presets.
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_tournament_type_check;

-- Total players allowed in the matchday squad (starting + bench) for this
-- fixture. NULL = not specified, app falls back to a sensible default.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS squad_size INTEGER;
