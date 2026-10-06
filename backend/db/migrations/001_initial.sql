-- 001_initial.sql: Veilora core schema for Control and Privacy Planes

CREATE TYPE plan_status AS ENUM (
  'draft',
  'simulated',
  'approved',
  'submitting',
  'settled',
  'failed',
  'refunded'
);

CREATE TYPE note_status AS ENUM (
  'unspent',
  'spent',
  'pending_unshield',
  'reclaimed'
);

-- Plans & Structured Intents
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal TEXT NOT NULL,
  constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  status plan_status NOT NULL DEFAULT 'draft',
  simulation JSONB,
  route JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Policies & Guardrails
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  max_fee_bps INTEGER NOT NULL DEFAULT 75,
  min_gas_reserve_wei NUMERIC(38, 0) NOT NULL DEFAULT 50000000000000000, -- 0.05 ETH
  require_clean_provenance BOOLEAN NOT NULL DEFAULT true,
  allowed_assets TEXT[] NOT NULL DEFAULT ARRAY['USDG', 'ETH', 'NVDA'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shielded Note Commitments & Nullifiers
CREATE TABLE IF NOT EXISTS shielded_notes (
  commitment TEXT PRIMARY KEY,
  nullifier_hash TEXT UNIQUE,
  asset_symbol TEXT NOT NULL,
  amount_wei NUMERIC(38, 0) NOT NULL,
  status note_status NOT NULL DEFAULT 'unspent',
  owner_view_tag TEXT,
  block_number BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  spent_at TIMESTAMPTZ
);

-- Outbox & Threshold Authorization (2-of-3 Shard Quorum)
CREATE TABLE IF NOT EXISTS outbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  quorum_type TEXT NOT NULL DEFAULT '2-of-3',
  signatures JSONB NOT NULL DEFAULT '[]'::jsonb,
  broadcaster_address TEXT,
  settlement_tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  submitted_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Local & Scoped Audit Receipts
CREATE TABLE IF NOT EXISTS audit_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  proof_type TEXT NOT NULL,
  proof_status TEXT NOT NULL,
  clean_provenance_set TEXT,
  final_note_commitment TEXT,
  receipt_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Execution Plane: Chain & Protocol Adapters
CREATE TABLE IF NOT EXISTS adapters (
  id TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Robinhood Chain Adapter (Chain ID 4663)
INSERT INTO adapters (id, chain_id, name, capabilities, is_enabled)
VALUES (
  'rhc-mainnet',
  4663,
  'Robinhood Chain',
  '{"erc4337": true, "dex": ["uniswap_v3"], "lending": ["morpho"], "supported_assets": ["USDG", "ETH", "NVDA"]}'::jsonb,
  true
) ON CONFLICT (id) DO NOTHING;
