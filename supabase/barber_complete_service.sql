-- BarberQueue Database Schema Update
-- Allow Barbers to Complete Tickets via RPC

-- Function to complete a service (handles RLS bypassing for barbers)
CREATE OR REPLACE FUNCTION barber_complete_service(
    p_ticket_id UUID,
    p_barber_id UUID,
    p_shop_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    -- Update the ticket if it belongs to this shop, is assigned to this barber, and is currently serving
    UPDATE tickets
    SET status = 'completed',
        updated_at = NOW()
    WHERE id = p_ticket_id
      AND shop_id = p_shop_id
      AND barber_id = p_barber_id
      AND status = 'serving';
      
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    IF v_updated_count > 0 THEN
        RETURN TRUE;
    ELSE
        -- Either ticket doesn't exist, doesn't belong to barber, or isn't serving
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (barbers)
GRANT EXECUTE ON FUNCTION barber_complete_service(UUID, UUID, UUID) TO authenticated;
