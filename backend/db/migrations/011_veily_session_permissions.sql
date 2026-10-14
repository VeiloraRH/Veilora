CREATE TABLE veily_session_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  request_id uuid NOT NULL UNIQUE,
  purpose text NOT NULL CHECK (char_length(purpose) BETWEEN 3 AND 120),
  scopes text[] NOT NULL CHECK (cardinality(scopes) BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX veily_session_permissions_wallet_idx
  ON veily_session_permissions (wallet_address, created_at DESC);
