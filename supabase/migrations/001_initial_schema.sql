-- ============================================
-- NETO v2 - Supabase Schema
-- Ejecutar este script en Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. TABLAS PRINCIPALES
-- ============================================

-- Households (vincula partners)
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  invite_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  split_method TEXT NOT NULL DEFAULT 'proportional'
    CHECK (split_method IN ('proportional', 'fixed')),
  fixed_split NUMERIC CHECK (fixed_split >= 0 AND fixed_split <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Participants (personas en un household)
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  income_ratio NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Accounts (brokerage accounts, per-user)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fee_type TEXT NOT NULL DEFAULT 'fixed' CHECK (fee_type IN ('fixed', 'percentage')),
  fee_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Transactions (buy/sell, per-user)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('arg_stocks', 'arg_cedears', 'arg_bonds')),
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  price NUMERIC NOT NULL CHECK (price > 0),
  fees NUMERIC NOT NULL DEFAULT 0 CHECK (fees >= 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  realized_pnl NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Income entries (per-user)
CREATE TABLE income_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  source TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('salary', 'freelance', 'investment', 'gift', 'other')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Expenses (shared within household)
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  total_amount NUMERIC NOT NULL CHECK (total_amount > 0),
  currency TEXT NOT NULL DEFAULT 'ARS',
  paid_by UUID NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  split_method TEXT NOT NULL DEFAULT 'proportional'
    CHECK (split_method IN ('proportional', 'fixed')),
  fixed_split NUMERIC CHECK (fixed_split >= 0 AND fixed_split <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Expense splits (computed per participant)
CREATE TABLE expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  share NUMERIC NOT NULL CHECK (share >= 0 AND share <= 1),
  amount NUMERIC NOT NULL,
  settled BOOLEAN NOT NULL DEFAULT false,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Preferences (per-user settings)
CREATE TABLE preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- ============================================
-- 2. TABLAS COMPARTIDAS (read-only cache)
-- ============================================

-- Exchange rates (shared, populated by cron/build)
CREATE TABLE exchange_rates (
  type TEXT NOT NULL CHECK (type IN ('mep', 'ccl')),
  date DATE NOT NULL,
  rate NUMERIC NOT NULL,
  PRIMARY KEY (type, date)
);

-- Historical prices (shared, populated by cron/build)
CREATE TABLE historical_prices (
  symbol TEXT NOT NULL,
  date DATE NOT NULL,
  open NUMERIC,
  close NUMERIC NOT NULL,
  PRIMARY KEY (symbol, date)
);

-- Portfolio history (per-user cache, recomputable)
CREATE TABLE portfolio_history (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  value NUMERIC NOT NULL,
  PRIMARY KEY (user_id, date)
);

-- Sync queue (offline-first pending changes)
CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  data JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  retry_count INTEGER NOT NULL DEFAULT 0
);

-- ============================================
-- 3. ÍNDICES
-- ============================================

CREATE INDEX idx_accounts_user ON accounts(user_id);
CREATE INDEX idx_accounts_user_deleted ON accounts(user_id, deleted_at);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_user_deleted ON transactions(user_id, deleted_at);
CREATE INDEX idx_income_user_date ON income_entries(user_id, date DESC);
CREATE INDEX idx_income_user_deleted ON income_entries(user_id, deleted_at);
CREATE INDEX idx_expenses_household_date ON expenses(household_id, date DESC);
CREATE INDEX idx_expenses_household_deleted ON expenses(household_id, deleted_at);
CREATE INDEX idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX idx_expense_splits_participant ON expense_splits(participant_id);
CREATE INDEX idx_participants_household ON participants(household_id);
CREATE INDEX idx_participants_user ON participants(user_id);
CREATE INDEX idx_sync_queue_user ON sync_queue(user_id, timestamp);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_prices ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4.1 Per-user tables (accounts, transactions, income_entries, preferences, portfolio_history, sync_queue)
-- ============================================

-- Accounts
CREATE POLICY "accounts_select" ON accounts FOR SELECT
  TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "accounts_insert" ON accounts FOR INSERT
  TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "accounts_update" ON accounts FOR UPDATE
  TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "accounts_delete" ON accounts FOR DELETE
  TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Transactions
CREATE POLICY "transactions_select" ON transactions FOR SELECT
  TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT
  TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "transactions_update" ON transactions FOR UPDATE
  TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "transactions_delete" ON transactions FOR DELETE
  TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Income entries
CREATE POLICY "income_select" ON income_entries FOR SELECT
  TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "income_insert" ON income_entries FOR INSERT
  TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "income_update" ON income_entries FOR UPDATE
  TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "income_delete" ON income_entries FOR DELETE
  TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Preferences
CREATE POLICY "preferences_select" ON preferences FOR SELECT
  TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "preferences_insert" ON preferences FOR INSERT
  TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "preferences_update" ON preferences FOR UPDATE
  TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "preferences_delete" ON preferences FOR DELETE
  TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Portfolio history
CREATE POLICY "portfolio_history_select" ON portfolio_history FOR SELECT
  TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "portfolio_history_insert" ON portfolio_history FOR INSERT
  TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "portfolio_history_update" ON portfolio_history FOR UPDATE
  TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "portfolio_history_delete" ON portfolio_history FOR DELETE
  TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Sync queue
CREATE POLICY "sync_queue_select" ON sync_queue FOR SELECT
  TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "sync_queue_insert" ON sync_queue FOR INSERT
  TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "sync_queue_update" ON sync_queue FOR UPDATE
  TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "sync_queue_delete" ON sync_queue FOR DELETE
  TO authenticated USING ((SELECT auth.uid()) = user_id);

-- ============================================
-- 4.2 Household-scoped tables (households, participants, expenses, expense_splits)
-- ============================================

-- Helper function: check if user belongs to household
CREATE OR REPLACE FUNCTION user_belongs_to_household(p_household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM participants
    WHERE household_id = p_household_id
    AND user_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  );
$$;

-- Households
CREATE POLICY "households_select" ON households FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM participants
      WHERE participants.household_id = households.id
      AND participants.user_id = (SELECT auth.uid())
      AND participants.deleted_at IS NULL
    )
  );
CREATE POLICY "households_insert" ON households FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "households_update" ON households FOR UPDATE
  TO authenticated USING (user_belongs_to_household(id))
  WITH CHECK (user_belongs_to_household(id));
CREATE POLICY "households_delete" ON households FOR DELETE
  TO authenticated USING (user_belongs_to_household(id));

-- Participants
CREATE POLICY "participants_select" ON participants FOR SELECT
  TO authenticated USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM participants p2
      WHERE p2.household_id = participants.household_id
      AND p2.user_id = (SELECT auth.uid())
      AND p2.deleted_at IS NULL
    )
  );
CREATE POLICY "participants_insert" ON participants FOR INSERT
  TO authenticated WITH CHECK (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM participants p2
      WHERE p2.household_id = participants.household_id
      AND p2.user_id = (SELECT auth.uid())
      AND p2.deleted_at IS NULL
    )
  );
CREATE POLICY "participants_update" ON participants FOR UPDATE
  TO authenticated USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM participants p2
      WHERE p2.household_id = participants.household_id
      AND p2.user_id = (SELECT auth.uid())
      AND p2.deleted_at IS NULL
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM participants p2
      WHERE p2.household_id = participants.household_id
      AND p2.user_id = (SELECT auth.uid())
      AND p2.deleted_at IS NULL
    )
  );
CREATE POLICY "participants_delete" ON participants FOR DELETE
  TO authenticated USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM participants p2
      WHERE p2.household_id = participants.household_id
      AND p2.user_id = (SELECT auth.uid())
      AND p2.deleted_at IS NULL
    )
  );

-- Expenses
CREATE POLICY "expenses_select" ON expenses FOR SELECT
  TO authenticated USING (user_belongs_to_household(household_id));
CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  TO authenticated WITH CHECK (
    user_belongs_to_household(household_id)
    AND created_by = (SELECT auth.uid())
  );
CREATE POLICY "expenses_update" ON expenses FOR UPDATE
  TO authenticated USING (user_belongs_to_household(household_id))
  WITH CHECK (user_belongs_to_household(household_id));
CREATE POLICY "expenses_delete" ON expenses FOR DELETE
  TO authenticated USING (user_belongs_to_household(household_id));

-- Expense splits
CREATE POLICY "expense_splits_select" ON expense_splits FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_splits.expense_id
      AND user_belongs_to_household(expenses.household_id)
    )
  );
CREATE POLICY "expense_splits_insert" ON expense_splits FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_splits.expense_id
      AND user_belongs_to_household(expenses.household_id)
    )
  );
CREATE POLICY "expense_splits_update" ON expense_splits FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_splits.expense_id
      AND user_belongs_to_household(expenses.household_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_splits.expense_id
      AND user_belongs_to_household(expenses.household_id)
    )
  );
CREATE POLICY "expense_splits_delete" ON expense_splits FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM expenses
      WHERE expenses.id = expense_splits.expense_id
      AND user_belongs_to_household(expenses.household_id)
    )
  );

-- ============================================
-- 4.3 Shared read-only tables (exchange_rates, historical_prices)
-- ============================================

CREATE POLICY "exchange_rates_select" ON exchange_rates FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "historical_prices_select" ON historical_prices FOR SELECT
  TO authenticated USING (true);

-- ============================================
-- 5. REALTIME
-- ============================================

-- Habilitar realtime para tablas que necesitan sync en tiempo real
ALTER PUBLICATION supabase_realtime ADD TABLE accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE income_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE expense_splits;

-- ============================================
-- 6. TRIGGERS (updated_at automático)
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_income_entries_updated_at
  BEFORE UPDATE ON income_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expense_splits_updated_at
  BEFORE UPDATE ON expense_splits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_households_updated_at
  BEFORE UPDATE ON households
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preferences_updated_at
  BEFORE UPDATE ON preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. GRANTS (required for RLS to work with raw SQL execution)
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON income_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON expense_splits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON households TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON portfolio_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sync_queue TO authenticated;
GRANT SELECT ON exchange_rates TO authenticated;
GRANT SELECT ON historical_prices TO authenticated;
