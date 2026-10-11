ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS registration_request_id TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS relayer_deployment_budget (
  utc_day DATE PRIMARY KEY,
  deployment_count INTEGER NOT NULL DEFAULT 0 CHECK (deployment_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
