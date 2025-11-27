-- Budgets Table for Finance Admin
-- Run this migration in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('game_day', 'training_session', 'gathering', 'event', 'other')),
  event_date DATE,
  description TEXT,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_by UUID REFERENCES user_profiles(user_id) NOT NULL,
  approved_by UUID REFERENCES user_profiles(user_id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);
CREATE INDEX IF NOT EXISTS idx_budgets_created_by ON budgets(created_by);
CREATE INDEX IF NOT EXISTS idx_budgets_event_type ON budgets(event_type);
CREATE INDEX IF NOT EXISTS idx_budgets_event_date ON budgets(event_date);

-- Budget Items Table
CREATE TABLE IF NOT EXISTS budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_items_budget_id ON budget_items(budget_id);

-- RLS Policies for Budgets
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

-- Finance admins and admins can view all budgets
CREATE POLICY "Finance admins and admins can view all budgets"
  ON budgets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'finance_admin')
    )
  );

-- Finance admins can create budgets
CREATE POLICY "Finance admins can create budgets"
  ON budgets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'finance_admin')
    )
  );

-- Finance admins can update their own budgets, admins can update any
CREATE POLICY "Finance admins can update own budgets"
  ON budgets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND (role = 'admin' OR (role = 'finance_admin' AND created_by = auth.uid()))
    )
  );

-- Admins can approve/reject budgets
CREATE POLICY "Admins can approve budgets"
  ON budgets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Budget items policies
CREATE POLICY "Finance admins and admins can view budget items"
  ON budget_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = budget_items.budget_id
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid() AND role IN ('admin', 'finance_admin')
      )
    )
  );

CREATE POLICY "Finance admins can manage budget items"
  ON budget_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM budgets
      WHERE budgets.id = budget_items.budget_id
      AND EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_id = auth.uid() AND role IN ('admin', 'finance_admin')
      )
    )
  );

