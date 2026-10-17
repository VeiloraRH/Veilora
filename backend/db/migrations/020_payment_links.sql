-- Payment links: a one-time address someone can pay without seeing the wallet's
-- main address. The link's private key never leaves the creator's browser; only
-- its public address and what the creator asked for are stored here.
CREATE TABLE IF NOT EXISTS payment_links (
  slug TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  link_address TEXT NOT NULL UNIQUE,
  asset TEXT NOT NULL CHECK (asset IN ('ETH', 'USDG')),
  amount_raw NUMERIC(78, 0) CHECK (amount_raw IS NULL OR amount_raw > 0),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS payment_links_wallet_idx ON payment_links (wallet_address, created_at DESC);
