CREATE TABLE IF NOT EXISTS wallet_spending_policies (
  wallet_address TEXT PRIMARY KEY REFERENCES wallets(address) ON DELETE CASCADE,
  per_transaction_percent SMALLINT NOT NULL DEFAULT 20 CHECK (per_transaction_percent BETWEEN 1 AND 100),
  daily_total_percent SMALLINT NOT NULL DEFAULT 20 CHECK (daily_total_percent BETWEEN 1 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE wallet_daily_spend
  ADD COLUMN IF NOT EXISTS daily_balance_wei NUMERIC(78, 0);
