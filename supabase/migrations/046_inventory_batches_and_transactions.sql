-- Inventory redesign: from a single editable "quantity" number to a proper
-- status breakdown (in store / in use / spoilt / lost) backed by an
-- append-only transaction log — the log is the source of truth, and the
-- counts on `inventory` are a cached total kept in sync by a trigger so no
-- code path can silently drift the number away from the log.
--
-- Model:
--   inventory            → item TYPE (e.g. "Rugby ball, size 5") + cached
--                           status totals across all its batches
--   inventory_batches     → one row per "delivery event" (e.g. the 13 balls
--                           received on 20 July), split into in_store /
--                           in_use / spoilt / lost, which must always sum to
--                           quantity_received
--   inventory_transactions → the log: every status change, who did it, and
--                           an optional note. Never updated/deleted — it's
--                           the audit trail.
--
-- Batch-level tracking only (not individual serialised units) — enough for
-- consumables like balls/cones/bibs where a serial per unit would be
-- overhead nobody maintains. Run this in the Supabase SQL editor.

-- ── inventory: extend with status totals + reorder threshold ──────────────
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS quantity_in_store INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS quantity_in_use INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS quantity_spoilt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS quantity_lost INTEGER NOT NULL DEFAULT 0;
-- Existing `quantity` column is kept and now means "usable stock on hand"
-- (in_store + in_use) — kept in sync by the trigger below so every existing
-- read of `quantity` elsewhere in the app (dashboards, low-stock checks)
-- keeps working without changes.
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 10;
-- Reconciliation nudge bookkeeping (see inventory_transactions "reconcile" below).
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS reconciliation_nudged_at TIMESTAMP WITH TIME ZONE;

-- ── inventory_batches ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory(id) ON DELETE CASCADE NOT NULL,
  source TEXT,                      -- e.g. "donation", "purchase", donor/supplier name
  date_received DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
  in_store INTEGER NOT NULL DEFAULT 0 CHECK (in_store >= 0),
  in_use INTEGER NOT NULL DEFAULT 0 CHECK (in_use >= 0),
  spoilt INTEGER NOT NULL DEFAULT 0 CHECK (spoilt >= 0),
  lost INTEGER NOT NULL DEFAULT 0 CHECK (lost >= 0),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- The four buckets must always account for every unit received — this is
  -- the constraint that keeps the batch internally honest.
  CONSTRAINT inventory_batches_counts_balance
    CHECK (in_store + in_use + spoilt + lost = quantity_received)
);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_item_id ON inventory_batches(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_date_received ON inventory_batches(date_received);

-- ── inventory_transactions — append-only audit log ─────────────────────
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory(id) ON DELETE CASCADE NOT NULL,
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('receive', 'issue', 'return', 'damage', 'loss', 'reconcile')),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  from_status TEXT CHECK (from_status IN ('in_store', 'in_use', 'spoilt', 'lost')),
  to_status TEXT CHECK (to_status IN ('in_store', 'in_use', 'spoilt', 'lost')),
  performed_by UUID REFERENCES user_profiles(user_id),
  linked_to TEXT,     -- optional free-text link, e.g. "U18 vs Kobs, 20 Jul"
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_id ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_batch_id ON inventory_transactions(batch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at);

-- ── Trigger: keep inventory's cached totals in sync with its batches ──────
-- This is the "counts are never edited directly" rule enforced in the DB —
-- inventory.quantity_in_store/in_use/spoilt/lost/quantity are recalculated
-- from inventory_batches every time a batch changes, so the log (batches,
-- which only move via the transactions above) is always the real source of
-- truth and the cached total can never drift from it.
CREATE OR REPLACE FUNCTION recalc_inventory_totals() RETURNS TRIGGER AS $$
DECLARE
  target_item_id UUID;
BEGIN
  target_item_id := COALESCE(NEW.item_id, OLD.item_id);

  UPDATE inventory SET
    quantity_in_store = COALESCE((SELECT SUM(in_store) FROM inventory_batches WHERE item_id = target_item_id), 0),
    quantity_in_use   = COALESCE((SELECT SUM(in_use)   FROM inventory_batches WHERE item_id = target_item_id), 0),
    quantity_spoilt   = COALESCE((SELECT SUM(spoilt)   FROM inventory_batches WHERE item_id = target_item_id), 0),
    quantity_lost     = COALESCE((SELECT SUM(lost)     FROM inventory_batches WHERE item_id = target_item_id), 0),
    quantity = COALESCE((SELECT SUM(in_store + in_use) FROM inventory_batches WHERE item_id = target_item_id), 0),
    updated_at = NOW()
  WHERE id = target_item_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_inventory_totals ON inventory_batches;
CREATE TRIGGER trg_recalc_inventory_totals
  AFTER INSERT OR UPDATE OR DELETE ON inventory_batches
  FOR EACH ROW EXECUTE FUNCTION recalc_inventory_totals();

CREATE TRIGGER update_inventory_batches_updated_at BEFORE UPDATE ON inventory_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ────────────────────────────────────────────────────────────────
-- Broaden inventory access: finance owns budgeting/replacement decisions and
-- gets the tracking alerts; coach and data_admin (team manager) are
-- operationally closest to the gear and log day-to-day issue/return/damage,
-- so they need to be able to write too, not just admin/data_admin as before.
DROP POLICY IF EXISTS "Admins and data admins can view inventory" ON inventory;
CREATE POLICY "Inventory viewers can view inventory"
  ON inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'data_admin', 'finance_admin', 'coach', 'physio')
    )
  );

DROP POLICY IF EXISTS "Admins and data admins can manage inventory" ON inventory;
CREATE POLICY "Inventory managers can manage inventory"
  ON inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'data_admin', 'finance_admin', 'coach')
    )
  );

ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inventory viewers can view batches"
  ON inventory_batches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'data_admin', 'finance_admin', 'coach', 'physio')
    )
  );

CREATE POLICY "Inventory managers can manage batches"
  ON inventory_batches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'data_admin', 'finance_admin', 'coach')
    )
  );

CREATE POLICY "Inventory viewers can view transactions"
  ON inventory_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'data_admin', 'finance_admin', 'coach', 'physio')
    )
  );

-- Transactions are an append-only audit log — inserts only, no update/delete
-- policy is defined, so once written a transaction can't be altered.
CREATE POLICY "Inventory managers can log transactions"
  ON inventory_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'data_admin', 'finance_admin', 'coach')
    )
  );
