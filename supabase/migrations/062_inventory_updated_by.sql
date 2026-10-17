-- Track who last edited an inventory item.
--
-- The table already has created_by (who first added the item). This adds the
-- parallel updated_by so the item card can show "Last updated by …" whenever
-- anyone with inventory access changes an item's details. updated_at already
-- exists; we set updated_by alongside it in the PATCH route.

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES user_profiles(user_id);
