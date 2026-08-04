-- Two additions to the Create Budget request flow:
--
-- 1. Duration: a budget can now span a date range (event_date = start,
--    event_end_date = end) instead of a single day, so multi-day events
--    (e.g. an away tournament weekend) can be budgeted properly.
--
-- 2. New categories: widen the event_type constraint to add Salaries,
--    Medical Stock, and Equipment/Stocks alongside the existing Game Day,
--    Training Session, Gathering, Event, and Other.
--
-- Run this in the Supabase SQL editor. Safe to run more than once.

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS event_end_date DATE;

ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_event_type_check;
ALTER TABLE budgets ADD CONSTRAINT budgets_event_type_check
  CHECK (event_type IN (
    'game_day', 'training_session', 'gathering', 'event', 'other',
    'salaries', 'medical_stock', 'equipment_stocks'
  ));
