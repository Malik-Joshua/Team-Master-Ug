-- Separate the club's name from its slogan. Previously onboarding only had a
-- single "club nickname or motto" field, which conflated the two. The slogan
-- is used to hype players/teams — e.g. shown on a player's dashboard when
-- they're selected for an upcoming fixture.
ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS club_slogan TEXT;
