-- BarberQueue Database Schema Update
-- Update get_next_ticket_number to support independent per-chair queues

-- We drop the old function first because we are changing the parameters
DROP FUNCTION IF EXISTS get_next_ticket_number(UUID);

-- Create new function that takes both shop and barber IDs
CREATE OR REPLACE FUNCTION get_next_ticket_number(p_shop_id UUID, p_barber_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_next_number INTEGER;
    v_today DATE;
BEGIN
    v_today := CURRENT_DATE;
    
    -- Calculate max ticket number specifically for THIS barber on THIS day
    SELECT COALESCE(MAX(ticket_number), 0) + 1
    INTO v_next_number
    FROM tickets
    WHERE shop_id = p_shop_id
    AND barber_id = p_barber_id
    AND DATE(created_at) = v_today;
    
    RETURN v_next_number;
END;
$$ LANGUAGE plpgsql;

-- Grant execute privileges
GRANT EXECUTE ON FUNCTION get_next_ticket_number(UUID, UUID) TO anon, authenticated;
