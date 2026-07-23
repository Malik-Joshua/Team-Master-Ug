-- Link expense/revenue transactions to a budget ("project") so the finance
-- dashboard can show a real per-project burndown (actual spend vs allocation).
--
-- Nullable + ON DELETE SET NULL: existing transactions stay valid, and a
-- transaction survives its budget being deleted (it just becomes untagged).
--
-- Run this in the Supabase SQL editor. All app code is written to work with or
-- without this column (graceful fallback), so applying it is safe at any time.

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_budget_id
  ON financial_transactions(budget_id);
