-- ============================================
-- SECURITY & ARCHITECTURE FIXES
-- Run in Supabase SQL Editor (once)
-- ============================================

-- ─────────────────────────────────────────────
-- FIX 1: RESTRICT TICKETS SELECT (PII LEAK)
-- ─────────────────────────────────────────────

-- Drop the open "viewable by everyone" policy
DROP POLICY IF EXISTS "Tickets are viewable by everyone" ON tickets;

-- 1a. Shop owners can read all tickets in their shop
CREATE POLICY "tickets_select_owner"
  ON tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = tickets.shop_id
        AND shops.owner_id = auth.uid()
    )
  );

-- 1b. Barbers can read tickets in their shop
CREATE POLICY "tickets_select_barber"
  ON tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM barbers
      WHERE barbers.shop_id = tickets.shop_id
        AND barbers.auth_id = auth.uid()
    )
  );

-- 1c. Customers can ONLY read their own ticket (matched by session_id column)
--     The frontend stores user_session_id and passes it via a WHERE filter,
--     which combined with this policy ensures full isolation.
CREATE POLICY "tickets_select_own_session"
  ON tickets FOR SELECT
  USING (
    -- Allow if the caller is looking at their own session's ticket
    user_session_id IS NOT NULL
    AND user_session_id = coalesce(
      current_setting('app.session_id', true),
      ''
    )
  );

-- ─────────────────────────────────────────────
-- FIX 2: RESTRICT TICKETS INSERT (DoS/SPAM)
-- ─────────────────────────────────────────────

-- Drop the open "insertable by anyone" policy
DROP POLICY IF EXISTS "Tickets are insertable by anyone" ON tickets;

-- Rate-limit: max 1 active (waiting/serving) ticket per session per shop
CREATE POLICY "tickets_insert_rate_limit"
  ON tickets FOR INSERT
  WITH CHECK (
    -- Shop must be open
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = tickets.shop_id
        AND shops.is_open = true
    )
    AND
    -- No duplicate active ticket for same session in same shop
    NOT EXISTS (
      SELECT 1 FROM tickets t2
      WHERE t2.shop_id        = tickets.shop_id
        AND t2.user_session_id = tickets.user_session_id
        AND t2.status          IN ('waiting', 'serving')
    )
  );

-- ─────────────────────────────────────────────
-- FIX 3: RACE CONDITION — Atomic create_ticket
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_ticket(
  p_shop_id     UUID,
  p_barber_id   UUID,
  p_name        TEXT,
  p_phone       TEXT,
  p_people      INTEGER,
  p_session_id  TEXT
)
RETURNS SETOF tickets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_num    INTEGER;
  v_last_reset  TIMESTAMPTZ;
  v_new_ticket  tickets;
BEGIN
  -- Advisory lock scoped to this (shop, barber) pair to serialize concurrent inserts
  PERFORM pg_advisory_xact_lock(
    hashtext(p_shop_id::text || p_barber_id::text)
  );

  -- Guard: shop must be open
  IF NOT EXISTS (SELECT 1 FROM shops WHERE id = p_shop_id AND is_open = true) THEN
    RAISE EXCEPTION 'shop_closed';
  END IF;

  -- Guard: session must not have an active ticket in this shop
  IF EXISTS (
    SELECT 1 FROM tickets
    WHERE shop_id        = p_shop_id
      AND user_session_id = p_session_id
      AND status          IN ('waiting', 'serving')
  ) THEN
    RAISE EXCEPTION 'duplicate_active_ticket';
  END IF;

  -- Determine last reset boundary
  SELECT COALESCE(last_reset_at, date_trunc('day', now()))
  INTO v_last_reset
  FROM shops WHERE id = p_shop_id;

  IF date(v_last_reset) < current_date THEN
    v_last_reset := date_trunc('day', now());
  END IF;

  -- Compute next ticket number atomically
  SELECT COALESCE(MAX(ticket_number), 0) + 1
  INTO v_next_num
  FROM tickets
  WHERE shop_id   = p_shop_id
    AND barber_id = p_barber_id
    AND created_at >= v_last_reset;

  -- Insert in the same transaction
  INSERT INTO tickets (
    shop_id, barber_id, customer_name,
    phone_number, people_count, ticket_number,
    user_session_id, status
  ) VALUES (
    p_shop_id, p_barber_id, p_name,
    p_phone, p_people, v_next_num,
    p_session_id, 'waiting'
  )
  RETURNING * INTO v_new_ticket;

  RETURN NEXT v_new_ticket;
END;
$$;

GRANT EXECUTE ON FUNCTION create_ticket(UUID, UUID, TEXT, TEXT, INTEGER, TEXT)
  TO anon, authenticated;

-- ─────────────────────────────────────────────
-- FIX 4: N+1 PERFORMANCE — get_people_ahead
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_people_ahead(
  p_shop_id    UUID,
  p_barber_id  UUID,
  p_created_at TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(people_count), 0)::INTEGER
  FROM tickets
  WHERE shop_id    = p_shop_id
    AND barber_id  = p_barber_id
    AND status     = 'waiting'
    AND created_at < p_created_at;
$$;

GRANT EXECUTE ON FUNCTION get_people_ahead(UUID, UUID, TIMESTAMPTZ)
  TO anon, authenticated;

-- ─────────────────────────────────────────────
-- FIX 4b: TV DISPLAY — Non-PII queue aggregate
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_queue_status_public(p_shop_id UUID)
RETURNS TABLE (
  barber_id     UUID,
  barber_name   TEXT,
  ticket_number INTEGER,
  status        TEXT,
  people_count  INTEGER
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT
    t.barber_id,
    b.name       AS barber_name,
    t.ticket_number,
    t.status,
    t.people_count
  FROM tickets t
  JOIN barbers b ON b.id = t.barber_id
  WHERE t.shop_id = p_shop_id
    AND t.status  IN ('waiting', 'serving')
  ORDER BY t.barber_id, t.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION get_queue_status_public(UUID)
  TO anon, authenticated;

-- ─────────────────────────────────────────────
-- UNIQUE SAFETY-NET CONSTRAINT
-- ─────────────────────────────────────────────

-- Prevent duplicate ticket numbers as a DB-level safety net
CREATE UNIQUE INDEX IF NOT EXISTS tickets_unique_number
  ON tickets (shop_id, barber_id, ticket_number)
  WHERE status != 'canceled';
