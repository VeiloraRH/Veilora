-- Key rotation. An account's address is derived from the keys it was created
-- with, so keep those for address checks and redeploys once a personal key
-- (Shard A or Shard C) has been replaced on-chain.
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS initial_shard_a_address TEXT;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS initial_shard_c_address TEXT;
UPDATE wallets SET initial_shard_a_address = shard_a_address WHERE initial_shard_a_address IS NULL;
UPDATE wallets SET initial_shard_c_address = shard_c_address WHERE initial_shard_c_address IS NULL;

-- A replacement waits out a delay so the other personal key can cancel it.
CREATE TABLE IF NOT EXISTS wallet_key_rotations (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('device', 'recovery')),
  new_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'expired')),
  request_signature TEXT NOT NULL UNIQUE,
  matures_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  cancelled_by TEXT CHECK (cancelled_by IN ('device', 'recovery')),
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS wallet_key_rotations_wallet_idx ON wallet_key_rotations(wallet_address, id DESC);
-- One open replacement per key at a time.
CREATE UNIQUE INDEX IF NOT EXISTS wallet_key_rotations_one_open ON wallet_key_rotations(wallet_address, kind) WHERE status = 'pending';
