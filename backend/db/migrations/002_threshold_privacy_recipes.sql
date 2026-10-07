-- 002_threshold_privacy_recipes.sql
-- Threshold Wallet Vaults (Shard B), Co-signer Auditing, Selective Disclosure View Keys & Recipes

-- 1. Threshold Wallets (2-of-3 MPC Quorum)
CREATE TABLE IF NOT EXISTS wallets (
  address TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL DEFAULT 4663,
  shard_a_address TEXT NOT NULL,
  shard_b_address TEXT NOT NULL,
  shard_b_encrypted TEXT NOT NULL, -- AES-256-GCM encrypted private key
  shard_c_address TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  threshold INTEGER NOT NULL DEFAULT 2,
  is_frozen BOOLEAN NOT NULL DEFAULT false,
  frozen_until TIMESTAMPTZ,
  freeze_reason TEXT,
  totp_secret_encrypted TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Immutable Co-Sign Audit Trail
CREATE TABLE IF NOT EXISTS cosign_audit (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  user_op_hash TEXT NOT NULL,
  status TEXT NOT NULL, -- 'APPROVED', 'REJECTED_FROZEN', 'REJECTED_POLICY'
  shard_b_signature TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Selective Disclosure & Scoped View Keys
CREATE TABLE IF NOT EXISTS view_keys (
  key_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'account', -- 'account', 'note', 'time_limited_auditor'
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  allowed_assets TEXT[] NOT NULL DEFAULT ARRAY['USDG', 'ETH', 'NVDA'],
  valid_until TIMESTAMPTZ,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Clean-Provenance Association Sets (PPOI)
CREATE TABLE IF NOT EXISTS provenance_sets (
  set_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_hash TEXT NOT NULL,
  member_count BIGINT NOT NULL DEFAULT 0,
  freshness_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Seed Initial Robinhood Chain USDG & NVDA Provenance Set
INSERT INTO provenance_sets (set_id, name, root_hash, member_count, freshness_timestamp, is_active)
VALUES (
  'rhc-clean-v1',
  'Robinhood Chain Verified Provenance Set v1',
  '0x7c9a4053896dfa1e64627ef678d120a1ef08d028a3915bc671b569d2d09df445',
  12850,
  now(),
  true
) ON CONFLICT (set_id) DO NOTHING;

-- 5. Composable Shielded DeFi Recipes
CREATE TABLE IF NOT EXISTS recipes (
  recipe_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  steps TEXT[] NOT NULL,
  supported_assets TEXT[] NOT NULL,
  max_slippage_bps INTEGER NOT NULL DEFAULT 50,
  requires_clean_provenance BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed standard Veilora recipes
INSERT INTO recipes (recipe_id, name, description, steps, supported_assets, max_slippage_bps, requires_clean_provenance)
VALUES
  (
    'shield-usdg',
    'Shield USDG',
    'Converts public USDG into private shielded UTXO note on Robinhood Chain',
    ARRAY['deposit', 'mint_commitment'],
    ARRAY['USDG'],
    10,
    true
  ),
  (
    'shield-swap-stock',
    'Shielded Stock Purchase',
    'Shields USDG, executes Uniswap V3 swap for tokenized stock, and commits shielded stock note',
    ARRAY['shield', 'swap', 'commit_note'],
    ARRAY['USDG', 'NVDA'],
    75,
    true
  ),
  (
    'shield-lend-morpho',
    'Private Morpho Lending',
    'Shielded balance yield allocation via Morpho protocol adapter',
    ARRAY['shield', 'supply_morpho'],
    ARRAY['USDG'],
    25,
    true
  ),
  (
    'safe-unshield',
    'Safe Unshield to Origin',
    'Deterministic unshield flow with automated timeout and refund guarantees',
    ARRAY['nullify_note', 'verify_provenance', 'payout'],
    ARRAY['USDG', 'ETH', 'NVDA'],
    20,
    true
  )
ON CONFLICT (recipe_id) DO NOTHING;
