-- Record which shard set a freeze. A freeze set with the offline recovery key
-- (Shard C) can only be changed or lifted with Shard C, so a stolen device
-- cannot undo it.
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS freeze_initiated_by TEXT
  CHECK (freeze_initiated_by IN ('device', 'recovery'));
