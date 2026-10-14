CREATE TABLE IF NOT EXISTS wallet_spend_reservations (
  wallet_address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  utc_day DATE NOT NULL,
  asset_address TEXT NOT NULL,
  execution_digest TEXT NOT NULL,
  amount_wei NUMERIC(78, 0) NOT NULL CHECK (amount_wei > 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'committed', 'released')),
  expires_at TIMESTAMPTZ NOT NULL,
  transaction_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet_address, utc_day, asset_address, execution_digest)
);

CREATE INDEX IF NOT EXISTS wallet_spend_reservations_active_idx
  ON wallet_spend_reservations (wallet_address, utc_day, asset_address, expires_at)
  WHERE status = 'reserved';
