-- Remove proofless privacy data and recipe scaffolding. Historical migrations remain immutable.
DROP TABLE IF EXISTS shielded_notes CASCADE;
DROP TABLE IF EXISTS view_keys CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP TYPE IF EXISTS note_status CASCADE;
DROP TYPE IF EXISTS plan_status CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS policies CASCADE;
DROP TABLE IF EXISTS outbox_items CASCADE;
DROP TABLE IF EXISTS audit_receipts CASCADE;
DROP TABLE IF EXISTS adapters CASCADE;
