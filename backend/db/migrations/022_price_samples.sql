-- USDG prices sampled every 15 minutes from the same Uniswap pools the wallet
-- swaps through, so the dashboard can show a 24-hour change without the browser
-- calling third-party price services. Kept for 8 days.
CREATE TABLE IF NOT EXISTS price_samples (
  symbol TEXT NOT NULL,
  sampled_at TIMESTAMPTZ NOT NULL,
  price_raw NUMERIC(78, 0) NOT NULL CHECK (price_raw > 0),
  PRIMARY KEY (symbol, sampled_at)
);

CREATE INDEX IF NOT EXISTS price_samples_time_idx ON price_samples (sampled_at);
