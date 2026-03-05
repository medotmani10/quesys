CREATE OR REPLACE FUNCTION process_next_customer(
    p_barber_id UUID,
    p_shop_id UUID
)
RETURNS TABLE (
    ticket_id UUID,
    ticket_number INTEGER,
    customer_name TEXT,
    people_count INTEGER
) AS $$
DECLARE
    v_ticket_id UUID;
    v_ticket_number INTEGER;
    v_customer_name TEXT;
    v_people_count INTEGER;
    v_current_serving UUID;
BEGIN
    -- First, complete any currently serving ticket for this barber
    SELECT tickets.id INTO v_current_serving
    FROM tickets
    WHERE tickets.barber_id = p_barber_id
    AND tickets.status = 'serving'
    FOR UPDATE SKIP LOCKED;
    
    IF v_current_serving IS NOT NULL THEN
        UPDATE tickets
        SET status = 'completed',
            updated_at = NOW()
        WHERE id = v_current_serving;
    END IF;
    
    -- Try to get the oldest waiting ticket assigned to this specific barber
    SELECT tickets.id, tickets.ticket_number, tickets.customer_name, tickets.people_count
    INTO v_ticket_id, v_ticket_number, v_customer_name, v_people_count
    FROM tickets
    WHERE tickets.shop_id = p_shop_id
    AND tickets.barber_id = p_barber_id
    AND tickets.status = 'waiting'
    ORDER BY tickets.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;
    
    -- If no specific ticket, try the general queue (barber_id IS NULL)
    IF v_ticket_id IS NULL THEN
        SELECT tickets.id, tickets.ticket_number, tickets.customer_name, tickets.people_count
        INTO v_ticket_id, v_ticket_number, v_customer_name, v_people_count
        FROM tickets
        WHERE tickets.shop_id = p_shop_id
        AND tickets.barber_id IS NULL
        AND tickets.status = 'waiting'
        ORDER BY tickets.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1;
    END IF;
    
    -- If we found a ticket, assign it to this barber
    IF v_ticket_id IS NOT NULL THEN
        UPDATE tickets
        SET status = 'serving',
            barber_id = p_barber_id,
            updated_at = NOW()
        WHERE id = v_ticket_id;
        
        RETURN QUERY SELECT v_ticket_id, v_ticket_number, v_customer_name, v_people_count;
    ELSE
        -- No customers waiting
        RAISE EXCEPTION 'no customers waiting';
    END IF;
END;
$$ LANGUAGE plpgsql;
