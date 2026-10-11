CREATE TABLE IF NOT EXISTS wallet_daily_spend (
  wallet_address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  utc_day DATE NOT NULL,
  asset_address TEXT NOT NULL,
  amount_wei NUMERIC(78, 0) NOT NULL CHECK (amount_wei >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet_address, utc_day, asset_address)
);
