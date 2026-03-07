-- 1. Add last_reset_at to shops table if it doesn't exist
ALTER TABLE shops ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Update the RPC to use last_reset_at from the shop
CREATE OR REPLACE FUNCTION get_next_ticket_number(p_shop_id UUID, p_barber_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    v_next_number INTEGER;
    v_today DATE;
    v_last_reset TIMESTAMPTZ;
BEGIN
    v_today := CURRENT_DATE;
    
    -- Get the last reset time for the shop, default to beginning of today if null
    SELECT COALESCE(last_reset_at, DATE_TRUNC('day', NOW()))
    INTO v_last_reset
    FROM shops
    WHERE id = p_shop_id;
    
    -- If the reset was on a previous day, we only care about today's tickets
    IF DATE(v_last_reset) < v_today THEN
        v_last_reset := DATE_TRUNC('day', NOW());
    END IF;

    IF p_barber_id IS NOT NULL THEN
        -- Get next number for this specific barber's queue since last reset
        SELECT COALESCE(MAX(ticket_number), 0) + 1
        INTO v_next_number
        FROM tickets
        WHERE shop_id = p_shop_id
        AND barber_id = p_barber_id
        AND created_at >= v_last_reset;
    ELSE
        -- Get next number for the general shop queue since last reset
        SELECT COALESCE(MAX(ticket_number), 0) + 1
        INTO v_next_number
        FROM tickets
        WHERE shop_id = p_shop_id
        AND barber_id IS NULL
        AND created_at >= v_last_reset;
    END IF;
    
    RETURN v_next_number;
END;
$$ LANGUAGE plpgsql;

-- Grant execute privileges
GRANT EXECUTE ON FUNCTION get_next_ticket_number(UUID, UUID) TO anon, authenticated;
