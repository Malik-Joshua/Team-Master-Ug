-- Migration 046 added quantity_in_store/in_use/spoilt/lost, all defaulting to
-- 0, but items that existed BEFORE that redesign (e.g. "Rugby balls: 13")
-- have no inventory_batches row — so their real stock never got represented
-- in the new status buckets, and quantity_in_store stayed 0 even though the
-- old `quantity` column still says 13. That's what made Issue/Return show as
-- disabled (0 available) for pre-existing items.
--
-- This creates one "opening balance" batch per such item — assumed fully
-- in_store, since there's no historical data saying otherwise — plus a
-- matching `receive` transaction so History shows where the number came
-- from rather than it silently appearing. The existing trigger from 046
-- then recalculates quantity_in_store/quantity from this batch automatically.
--
-- Safe to run more than once: it only creates a batch for an item that
-- doesn't already have one, so it won't double-count anything.

INSERT INTO inventory_batches (item_id, source, date_received, quantity_received, in_store, in_use, spoilt, lost, notes, created_by)
SELECT
  i.id,
  'Legacy stock (recorded before batch tracking)',
  i.created_at::date,
  i.quantity,
  i.quantity,
  0, 0, 0,
  'Backfilled automatically when batch/transaction tracking was introduced.',
  i.created_by
FROM inventory i
WHERE i.quantity > 0
  AND NOT EXISTS (SELECT 1 FROM inventory_batches b WHERE b.item_id = i.id);

INSERT INTO inventory_transactions (item_id, batch_id, type, quantity, from_status, to_status, performed_by, note)
SELECT b.item_id, b.id, 'receive', b.quantity_received, NULL, 'in_store', b.created_by, 'Legacy stock — backfilled opening balance'
FROM inventory_batches b
WHERE b.source = 'Legacy stock (recorded before batch tracking)'
  AND NOT EXISTS (SELECT 1 FROM inventory_transactions t WHERE t.batch_id = b.id);
