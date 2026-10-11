-- Store keyed IP hashes so registration limits apply across backend replicas
-- and restarts without persisting raw client IP addresses.
CREATE TABLE IF NOT EXISTS wallet_registration_rate_limits (
  ip_hash TEXT PRIMARY KEY CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_registration_rate_limits_window_idx
  ON wallet_registration_rate_limits(window_started_at);
