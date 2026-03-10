-- ============================================================
-- Remove Session ID Requirement for Fetching and Canceling
-- ============================================================
-- The user requested to remove the session_id constraint from the logic
-- since tickets with QR codes are printed from the admin dashboard and
-- then scanned by the customer's phone, which has a different session ID.

CREATE OR REPLACE FUNCTION get_my_ticket(
    p_ticket_id UUID,
    p_session_id TEXT -- Kept to avoid changing frontend RPC signature
)
RETURNS SETOF tickets
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Removed 'AND user_session_id = p_session_id'
    RETURN QUERY
    SELECT * FROM tickets
    WHERE id = p_ticket_id;
END;
$$;

CREATE OR REPLACE FUNCTION cancel_my_ticket(
    p_ticket_id UUID,
    p_session_id TEXT -- Kept to avoid changing frontend RPC signature
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
      -- Removed 'AND user_session_id = p_session_id'
      AND status IN ('waiting', 'serving');

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    RETURN v_rows_affected > 0;
END;
$$;
