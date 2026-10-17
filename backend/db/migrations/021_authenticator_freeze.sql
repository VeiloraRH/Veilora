-- Authenticator app codes that can freeze a wallet from any device. A secret is
-- only active once a code from it has been confirmed; each code works once.
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS totp_pending_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS totp_last_step BIGINT;
