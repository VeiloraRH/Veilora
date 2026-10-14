-- Keep an auditable request count without persisting assistant prompts or keys.
CREATE TABLE IF NOT EXISTS veily_daily_usage (
  wallet_address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  utc_day DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet_address, utc_day)
);

CREATE TABLE IF NOT EXISTS veily_request_ids (
  request_id TEXT PRIMARY KEY CHECK (request_id ~ '^[0-9a-f-]{36}$'),
  wallet_address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS veily_request_ids_created_at_idx
  ON veily_request_ids(created_at);
