-- Alerts: in-app notifications about price thresholds, incoming funds, rule
-- runs and security events. Each alert is unique per wallet and reference so
-- a re-scan never duplicates it.
CREATE TABLE IF NOT EXISTS wallet_alerts (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('price', 'incoming', 'rule', 'security')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'success', 'warn', 'danger')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  ref TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  UNIQUE (wallet_address, ref)
);
CREATE INDEX IF NOT EXISTS wallet_alerts_feed_idx ON wallet_alerts(wallet_address, id DESC);

-- Per-wallet choices. A row exists once the owner opens Alerts; only those
-- wallets are scanned for incoming transfers.
CREATE TABLE IF NOT EXISTS wallet_alert_settings (
  wallet_address TEXT PRIMARY KEY REFERENCES wallets(address) ON DELETE CASCADE,
  incoming BOOLEAN NOT NULL DEFAULT true,
  rules BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_price_alerts (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  asset TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('above', 'below')),
  price_usdg TEXT NOT NULL,
  armed BOOLEAN NOT NULL DEFAULT true,
  last_price TEXT,
  last_checked_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_price_alerts_wallet_idx ON wallet_price_alerts(wallet_address);

-- Block cursor for the shared incoming-transfer scan.
CREATE TABLE IF NOT EXISTS alert_scan_cursor (
  name TEXT PRIMARY KEY,
  block NUMERIC(78, 0) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Each Shard A authorization for an alerts change is single use.
CREATE TABLE IF NOT EXISTS wallet_alert_authorizations (
  signature TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
