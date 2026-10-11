-- Preserve the factory that derived each account so future factory deployments
-- do not strand counterfactual accounts from earlier versions.
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS factory_address TEXT;

UPDATE wallets
SET factory_address = '0x210f310f150c0df3224d61ca7dcaf3e1ad578bd7'
WHERE factory_address IS NULL;

ALTER TABLE wallets
  ALTER COLUMN factory_address SET NOT NULL;
