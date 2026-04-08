-- Migration 004: Evolve api_keys schema
-- The api_keys table was created in 001_init.sql with is_active + no tier.
-- This migration adds the columns expected by the B2B auth middleware.

-- Add tier column (used by api_key.py middleware)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'explorer';

-- Add revoked column (middleware checks this; is the inverse of is_active)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoked BOOLEAN NOT NULL DEFAULT FALSE;

-- Sync: if is_active was set to false on any existing rows, mark as revoked
UPDATE api_keys SET revoked = TRUE WHERE is_active = FALSE;

-- Make name optional — generate-api-key route doesn't always supply it
ALTER TABLE api_keys ALTER COLUMN name DROP NOT NULL;
ALTER TABLE api_keys ALTER COLUMN name SET DEFAULT NULL;

-- Drop redundant is_active now that revoked is the canonical field
-- (keep commented out until confirmed no other code reads is_active)
-- ALTER TABLE api_keys DROP COLUMN is_active;

-- Rebuild the auth hot-path index to include revoked
DROP INDEX IF EXISTS idx_api_keys_hash;
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE NOT revoked;
