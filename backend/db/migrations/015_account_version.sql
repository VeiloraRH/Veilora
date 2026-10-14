ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS account_version SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE wallets
  ADD CONSTRAINT wallets_account_version_check CHECK (account_version IN (1, 2));
