-- Expand the allowed player positions to the full rugby taxonomy.
--
-- The original constraint (migration 001) allowed a single 'prop', a single
-- 'flanker' and a single 'winger', with no full-back. The role-card feature
-- introduces distinct positions:
--   prop     -> loosehead_prop / tighthead_prop
--   flanker  -> blindside_flanker / openside_flanker
--   winger   -> left_wing / right_wing
--   (new)    -> full_back
--
-- Legacy values ('prop', 'flanker', 'winger') are kept so existing rows remain
-- valid; the app normalizes them to a default card on display.

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_position_check;

ALTER TABLE players ADD CONSTRAINT players_position_check CHECK (
  position IN (
    -- Forwards
    'prop',            -- legacy
    'loosehead_prop',
    'tighthead_prop',
    'hooker',
    'lock',
    'flanker',         -- legacy
    'blindside_flanker',
    'openside_flanker',
    '8th_man',
    -- Backs
    'scrum_half',
    'fly_half',
    'inside_center',
    'outside_center',
    'winger',          -- legacy
    'left_wing',
    'right_wing',
    'full_back'
  )
);
