-- ============================================================
-- Ticket Adoption Protocol (Admin to Customer Handoff)
-- ============================================================

-- This function allows a customer device to securely "adopt" a ticket
-- that was manually created by an admin (which has user_session_id = 'ADMIN_CREATED').
-- Once adopted, the ticket becomes owned by the customer's device fingerprint,
-- enabling them to cancel it, and preventing them from booking another ticket online.

CREATE OR REPLACE FUNCTION claim_admin_ticket(
    p_ticket_id UUID,
    p_session_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_rows_affected INTEGER;
    v_shop_id UUID;
BEGIN
    -- First, check if the customer ALREADY has an active ticket for THIS shop.
    -- If they do, we cannot let them adopt another one (enforces the 1-ticket limit).
    -- To do this, we need to know the shop_id of the ticket they are trying to adopt.
    SELECT shop_id INTO v_shop_id
    FROM tickets
    WHERE id = p_ticket_id AND user_session_id = 'ADMIN_CREATED' AND status IN ('waiting', 'serving');

    -- If no such adoptable ticket exists, return false.
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Check if the user already has an active ticket for this shop
    IF EXISTS (
        SELECT 1 FROM tickets
        WHERE shop_id = v_shop_id
          AND user_session_id = p_session_id
          AND status IN ('waiting', 'serving')
    ) THEN
        -- They already have an active ticket, so they cannot adopt this one.
        RETURN FALSE;
    END IF;

    -- Proceed with adoption
    UPDATE tickets
    SET user_session_id = p_session_id,
        updated_at = NOW()
    WHERE id = p_ticket_id
      AND user_session_id = 'ADMIN_CREATED'
      AND status IN ('waiting', 'serving');

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    RETURN v_rows_affected > 0;
END;
$$;

-- Grant access to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION claim_admin_ticket(UUID, TEXT) TO anon, authenticated;
