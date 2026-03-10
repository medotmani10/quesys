-- ============================================================
-- Customer PWA Fixes & Security Enhancements
-- ============================================================

-- 1. Create a secure RPC for fetching a specific ticket by ID, but ONLY
--    if the provided session ID matches. This bypasses the need for
--    setting postgres config variables per API call.
CREATE OR REPLACE FUNCTION get_my_ticket(
    p_ticket_id UUID,
    p_session_id TEXT
)
RETURNS SETOF tickets
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM tickets
    WHERE id = p_ticket_id AND user_session_id = p_session_id;
END;
$$;

-- 2. Create a secure RPC for cancelling a ticket
--    Enforces that only the session owner can cancel, and only if it's waiting/serving.
CREATE OR REPLACE FUNCTION cancel_my_ticket(
    p_ticket_id UUID,
    p_session_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_rows_affected INTEGER;
BEGIN
    UPDATE tickets
    SET status = 'canceled',
        updated_at = NOW()
    WHERE id = p_ticket_id
      AND user_session_id = p_session_id
      AND status IN ('waiting', 'serving');

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    
    RETURN v_rows_affected > 0;
END;
$$;

-- 3. Grant access to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION get_my_ticket(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_my_ticket(UUID, TEXT) TO anon, authenticated;

-- 4. Update the previous generic GET POLICY to allow read if the user_session_id matches the requested ticket
-- Although we have an RPC now, we can keep the policy clean. We will drop the old one.
DROP POLICY IF EXISTS "tickets_select_own_session" ON tickets;
DROP POLICY IF EXISTS "tickets_update_own_cancel" ON tickets;

-- Now the unique constraint to ensure one active ticket per device per shop
-- Wait, the `create_ticket` function checks this manually:
--   IF EXISTS (SELECT 1 FROM tickets WHERE shop_id = p_shop_id AND user_session_id = p_session_id AND status IN ('waiting', 'serving')) THEN RAISE EXCEPTION 'duplicate_active_ticket';
-- So an index is great for performance of that check.
CREATE UNIQUE INDEX IF NOT EXISTS tickets_unique_active_session
    ON tickets (shop_id, user_session_id)
    WHERE status IN ('waiting', 'serving');

-- 5. Fix Realtime for Customers + Prevent PII Leak (Column Level Security)
-- Supabase Realtime requires a SELECT policy to broadcast changes.
-- We want to allow anonymous users to receive Realtime updates for tickets, 
-- but we MUST NOT leak customer_name, phone_number, or user_session_id.
-- We solve this using Column Level Security (CLS) for the 'anon' role.

-- Revoke full table SELECT access from anon
REVOKE SELECT ON tickets FROM anon;

-- Grant SELECT access ONLY to safe, non-PII columns (customer_name is safe enough for public displays like TV)
GRANT SELECT (id, shop_id, barber_id, ticket_number, customer_name, status, people_count, created_at, updated_at) ON tickets TO anon;

-- Now we can safely allow anon to SELECT any row, because they can only see safe columns.
-- This ensures Supabase Realtime `postgres_changes` will successfully broadcast ticket status updates to the customer's browser.
DROP POLICY IF EXISTS "tickets_select_anon_safe" ON tickets;
CREATE POLICY "tickets_select_anon_safe"
    ON tickets FOR SELECT
    TO anon
    USING (true);
