ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS salt NUMERIC(78, 0) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS relayer_daily_gas_budget (
  wallet_address TEXT NOT NULL,
  utc_day DATE NOT NULL,
  cost_wei NUMERIC(78, 0) NOT NULL DEFAULT 0,
  PRIMARY KEY (wallet_address, utc_day)
);
