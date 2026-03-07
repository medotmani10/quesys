-- Add auth_id column to barbers table
ALTER TABLE public.barbers
ADD COLUMN auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Function: process_barber_next_customer
-- Purpose: Finds the oldest waiting ticket assigned to THIS barber. 
--          If none exists, it finds the oldest unassigned waiting ticket and assigns it to THIS barber.
--          Updates the status to 'serving' and returns the ticket details.

CREATE OR REPLACE FUNCTION process_barber_next_customer(p_barber_id UUID, p_shop_id UUID)
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
BEGIN
    -- 1. Try to find the oldest waiting ticket assigned explicitly to this barber
    SELECT id, tickets.ticket_number, tickets.customer_name, tickets.people_count
    INTO v_ticket_id, v_ticket_number, v_customer_name, v_people_count
    FROM public.tickets
    WHERE shop_id = p_shop_id 
      AND status = 'waiting' 
      AND barber_id = p_barber_id
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- 2. If no ticket assigned to this barber, look for the oldest unassigned ticket
    IF v_ticket_id IS NULL THEN
        SELECT id, tickets.ticket_number, tickets.customer_name, tickets.people_count
        INTO v_ticket_id, v_ticket_number, v_customer_name, v_people_count
        FROM public.tickets
        WHERE shop_id = p_shop_id 
          AND status = 'waiting' 
          AND barber_id IS NULL
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;
    END IF;

    -- 3. If a ticket was found (either assigned to this barber, or unassigned)
    IF v_ticket_id IS NOT NULL THEN
        -- Mark as serving and assign to this barber (if it was unassigned)
        UPDATE public.tickets
        SET status = 'serving',
            barber_id = p_barber_id,
            updated_at = NOW()
        WHERE id = v_ticket_id;

        -- Return the selected ticket
        RETURN QUERY SELECT v_ticket_id, v_ticket_number, v_customer_name, v_people_count;
    END IF;

    -- If no tickets found, return empty
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
