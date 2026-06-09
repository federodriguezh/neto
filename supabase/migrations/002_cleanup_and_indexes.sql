-- ============================================
-- NETO Migration 002
-- Drop dead tables, add indexes for promoted tables
-- ============================================

-- 1. Drop dead sync_queue table (client uses IndexedDB syncQueue instead)
DROP TABLE IF EXISTS sync_queue;

-- 2. Add indexes for promoted read-heavy tables
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(date);
CREATE INDEX IF NOT EXISTS idx_historical_prices_date ON historical_prices(date);
CREATE INDEX IF NOT EXISTS idx_portfolio_history_user_date ON portfolio_history(user_id, date DESC);

-- 3. Add updated_at trigger for portfolio_history (used for sync conflict resolution)
CREATE TRIGGER IF NOT EXISTS update_portfolio_history_updated_at
  BEFORE UPDATE ON portfolio_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Update RLS grant (sync_queue was removed, no new grants needed for others)
