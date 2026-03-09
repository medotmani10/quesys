-- ============================================================
-- FINAL FIX FOR TICKET CREATION (409 CONFLICT & RECURSION)
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. FIX RECURSION: Drop the redundant and recursive RLS policy
-- This policy was trying to check for duplicates on the same table during insert,
-- causing Postgres to loop infinitely. The create_ticket RPC already handles this check.
DROP POLICY IF EXISTS "tickets_insert_rate_limit" ON tickets;

-- 2. FIX 409 CONFLICT: Drop the restrictive unique index and recreate it properly
-- The old index prevented reusing ticket numbers even on different days.
DROP INDEX IF EXISTS tickets_unique_number;

-- Recreate a safer unique index that only prevents duplicates for ACTIVE tickets.
-- This allows ticket numbers (1, 2, 3...) to be reused every day after reset.
CREATE UNIQUE INDEX tickets_unique_number
    ON tickets (shop_id, barber_id, ticket_number)
    WHERE status IN ('waiting', 'serving');

-- 3. ENSURE PERMISSIONS: Re-grant execute on the RPC just in case
GRANT EXECUTE ON FUNCTION create_ticket(UUID, UUID, TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;

-- 4. FIX SESSION SECURITY: Ensure the session variable is available for RLS
-- (This helps the 'tickets_select_own_session' policy work correctly)
ALTER TABLE tickets ALTER COLUMN user_session_id SET NOT NULL;
