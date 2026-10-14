-- Add funds sessions: one row per MoonPay checkout. Relay-routed purchases
-- record the deposit address that bridges to the smart account.
CREATE TABLE IF NOT EXISTS onramp_sessions (
  id UUID PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  asset TEXT NOT NULL CHECK (asset IN ('USDG', 'ETH')),
  route TEXT NOT NULL CHECK (route IN ('direct', 'relay')),
  currency_code TEXT NOT NULL,
  deposit_address TEXT,
  relay_request_id TEXT,
  fiat_amount NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onramp_sessions_wallet_idx ON onramp_sessions(wallet_address, created_at DESC);
