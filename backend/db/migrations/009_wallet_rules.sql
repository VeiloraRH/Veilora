-- Wallet Rules: user-defined triggers that prepare swaps for the owner to approve.
-- Rules never hold signing authority; every execution still goes through
-- Shard A plus the Shard B co-signer policy.
CREATE TABLE IF NOT EXISTS wallet_rules (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  name TEXT NOT NULL,
  spec JSONB NOT NULL,
  spec_hash TEXT NOT NULL CHECK (spec_hash ~ '^0x[0-9a-f]{64}$'),
  mode TEXT NOT NULL CHECK (mode IN ('approval')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked', 'expired')),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('incoming', 'schedule', 'price')),
  expires_at TIMESTAMPTZ NOT NULL,
  next_run_at TIMESTAMPTZ,
  last_scanned_block NUMERIC(78, 0),
  price_armed BOOLEAN NOT NULL DEFAULT true,
  last_price TEXT,
  last_checked_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_rules_wallet_idx ON wallet_rules(wallet_address);
CREATE INDEX IF NOT EXISTS wallet_rules_active_idx ON wallet_rules(status, trigger_type) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS wallet_rule_executions (
  id BIGSERIAL PRIMARY KEY,
  rule_id BIGINT NOT NULL REFERENCES wallet_rules(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'executed', 'failed', 'declined', 'skipped', 'expired')),
  trigger_ref TEXT NOT NULL,
  trigger_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_asset TEXT NOT NULL,
  total_raw NUMERIC(78, 0) NOT NULL CHECK (total_raw >= 0),
  legs JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason TEXT,
  tx_hashes TEXT[] NOT NULL DEFAULT '{}',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  UNIQUE (rule_id, trigger_ref)
);

CREATE INDEX IF NOT EXISTS wallet_rule_executions_wallet_idx ON wallet_rule_executions(wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_rule_executions_pending_idx ON wallet_rule_executions(status, expires_at) WHERE status = 'pending';

-- Each Shard A authorization for a rule change is single use.
CREATE TABLE IF NOT EXISTS wallet_rule_authorizations (
  signature TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
