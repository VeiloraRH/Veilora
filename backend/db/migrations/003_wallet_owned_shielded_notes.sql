-- Associate server-side shielded notes with the Veilora account that created them.
-- Existing rows remain unassigned because their owner cannot be proven by this migration.
ALTER TABLE shielded_notes
  ADD COLUMN IF NOT EXISTS wallet_address TEXT
  REFERENCES wallets(address) ON DELETE CASCADE;

ALTER TABLE shielded_notes
  ADD COLUMN IF NOT EXISTS creation_request_id TEXT;

CREATE INDEX IF NOT EXISTS shielded_notes_wallet_address_idx
  ON shielded_notes(wallet_address);

CREATE UNIQUE INDEX IF NOT EXISTS shielded_notes_creation_request_id_idx
  ON shielded_notes(creation_request_id)
  WHERE creation_request_id IS NOT NULL;
