-- ============================================================
-- BARBERTICKET — Full Database Reset & Migration
-- ============================================================
-- Instructions:
--   1. Open the Supabase Dashboard → SQL Editor
--   2. Paste this ENTIRE file and click "Run"
--   3. This script is IDEMPOTENT — safe to run multiple times
-- ============================================================


-- ─── STEP 1: TEARDOWN (drop everything in reverse dependency order) ──────────

-- Drop RLS policies first (they reference tables)
DO $$ BEGIN

  -- tickets policies
  DROP POLICY IF EXISTS "Tickets are viewable by everyone"    ON tickets;
  DROP POLICY IF EXISTS "Tickets are insertable by anyone"    ON tickets;
  DROP POLICY IF EXISTS "Tickets are updatable by shop owner" ON tickets;
  DROP POLICY IF EXISTS "Tickets are deletable by shop owner" ON tickets;
  DROP POLICY IF EXISTS "tickets_select_owner"                ON tickets;
  DROP POLICY IF EXISTS "tickets_select_barber"               ON tickets;
  DROP POLICY IF EXISTS "tickets_select_own_session"          ON tickets;
  DROP POLICY IF EXISTS "tickets_insert_rate_limit"           ON tickets;
  DROP POLICY IF EXISTS "tickets_update_owner"                ON tickets;
  DROP POLICY IF EXISTS "tickets_update_barber"               ON tickets;
  DROP POLICY IF EXISTS "tickets_update_own_cancel"           ON tickets;
  DROP POLICY IF EXISTS "tickets_delete_owner"                ON tickets;

  -- barbers policies
  DROP POLICY IF EXISTS "Barbers are viewable by everyone"       ON barbers;
  DROP POLICY IF EXISTS "Barbers are insertable by shop owner"   ON barbers;
  DROP POLICY IF EXISTS "Barbers are updatable by shop owner"    ON barbers;
  DROP POLICY IF EXISTS "Barbers can update their own profile"   ON barbers;
  DROP POLICY IF EXISTS "barbers_select_public"                  ON barbers;
  DROP POLICY IF EXISTS "barbers_insert_owner"                   ON barbers;
  DROP POLICY IF EXISTS "barbers_update_owner_or_self"           ON barbers;
  DROP POLICY IF EXISTS "barbers_delete_owner"                   ON barbers;

  -- shops policies
  DROP POLICY IF EXISTS "Shops are viewable by everyone"   ON shops;
  DROP POLICY IF EXISTS "Shops are insertable by owner"    ON shops;
  DROP POLICY IF EXISTS "Shops are updatable by owner"     ON shops;
  DROP POLICY IF EXISTS "Shops are deletable by owner"     ON shops;
  DROP POLICY IF EXISTS "shops_select_public"              ON shops;
  DROP POLICY IF EXISTS "shops_insert_owner"               ON shops;
  DROP POLICY IF EXISTS "shops_update_owner"               ON shops;
  DROP POLICY IF EXISTS "shops_delete_owner"               ON shops;

EXCEPTION WHEN undefined_table THEN
  NULL; -- tables don't exist yet, that's fine
END $$;

-- Drop triggers
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column()                          CASCADE;
DROP FUNCTION IF EXISTS create_ticket(UUID, UUID, TEXT, TEXT, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_people_ahead(UUID, UUID, TIMESTAMPTZ)           CASCADE;
DROP FUNCTION IF EXISTS get_queue_status_public(UUID)                       CASCADE;
DROP FUNCTION IF EXISTS process_next_customer(UUID, UUID)                   CASCADE;
DROP FUNCTION IF EXISTS get_next_ticket_number(UUID)                        CASCADE;

-- Drop tables (in reverse FK order)
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS barbers CASCADE;
DROP TABLE IF EXISTS shops   CASCADE;


-- ─── STEP 2: EXTENSIONS ─────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ─── STEP 3: TABLES ─────────────────────────────────────────────────────────

-- Shops
CREATE TABLE shops (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slug          TEXT        UNIQUE NOT NULL,
    name          TEXT        NOT NULL,
    logo_url      TEXT,
    maps_url      TEXT,
    phone         TEXT,
    is_open       BOOLEAN     NOT NULL DEFAULT true,
    last_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Barbers
CREATE TABLE barbers (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id    UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    auth_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    name       TEXT        NOT NULL,
    is_active  BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tickets
CREATE TABLE tickets (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id         UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    barber_id       UUID        REFERENCES barbers(id) ON DELETE SET NULL,
    customer_name   TEXT        NOT NULL,
    phone_number    TEXT        NOT NULL,
    people_count    INTEGER     NOT NULL DEFAULT 1 CHECK (people_count >= 1),
    ticket_number   INTEGER     NOT NULL,
    user_session_id TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'waiting'
                                CHECK (status IN ('waiting', 'serving', 'completed', 'canceled')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── STEP 4: INDEXES ────────────────────────────────────────────────────────

CREATE INDEX idx_shops_owner_id    ON shops(owner_id);
CREATE INDEX idx_shops_slug        ON shops(slug);
CREATE INDEX idx_barbers_shop_id   ON barbers(shop_id);
CREATE INDEX idx_barbers_auth_id   ON barbers(auth_id);
CREATE INDEX idx_tickets_shop_id   ON tickets(shop_id);
CREATE INDEX idx_tickets_barber_id ON tickets(barber_id);
CREATE INDEX idx_tickets_status    ON tickets(status);
CREATE INDEX idx_tickets_session   ON tickets(user_session_id);
CREATE INDEX idx_tickets_created   ON tickets(created_at);

-- Unique constraint: no two ACTIVE tickets can share the same number for the same barber.
-- Using status IN ('waiting','serving') means completed/canceled tickets never conflict,
-- so daily ticket numbers (1, 2, 3 …) can be safely reused after a reset.
CREATE UNIQUE INDEX tickets_unique_active_number
    ON tickets (shop_id, barber_id, ticket_number)
    WHERE status IN ('waiting', 'serving');


-- ─── STEP 5: TRIGGER — auto-update updated_at ───────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ─── STEP 6: STORED FUNCTIONS ───────────────────────────────────────────────

-- [1] create_ticket — atomic, race-condition-safe ticket creation
--     • Acquires advisory lock per (shop, barber) so concurrent calls are serialised.
--     • Validates: shop is open, session has no active ticket.
--     • Computes next ticket number from tickets created since last_reset_at.
CREATE OR REPLACE FUNCTION create_ticket(
    p_shop_id    UUID,
    p_barber_id  UUID,
    p_name       TEXT,
    p_phone      TEXT,
    p_people     INTEGER,
    p_session_id TEXT
)
RETURNS SETOF tickets
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_next_num   INTEGER;
    v_last_reset TIMESTAMPTZ;
    v_new_ticket tickets;
BEGIN
    -- Serialise concurrent requests for the same (shop, barber) pair
    PERFORM pg_advisory_xact_lock(
        hashtext(p_shop_id::text || COALESCE(p_barber_id::text, 'any'))
    );

    -- Guard: shop must exist and be open
    IF NOT EXISTS (
        SELECT 1 FROM shops WHERE id = p_shop_id AND is_open = true
    ) THEN
        RAISE EXCEPTION 'shop_closed';
    END IF;

    -- Guard: session must not already have an active ticket at this shop
    IF EXISTS (
        SELECT 1 FROM tickets
        WHERE shop_id        = p_shop_id
          AND user_session_id = p_session_id
          AND status         IN ('waiting', 'serving')
    ) THEN
        RAISE EXCEPTION 'duplicate_active_ticket';
    END IF;

    -- Determine reset boundary (reset daily if last_reset_at is from a previous day)
    SELECT last_reset_at INTO v_last_reset FROM shops WHERE id = p_shop_id;

    IF date(v_last_reset AT TIME ZONE 'UTC') < current_date THEN
        v_last_reset := date_trunc('day', now() AT TIME ZONE 'UTC');
    END IF;

    -- Compute next sequential ticket number for this barber since last reset
    SELECT COALESCE(MAX(ticket_number), 0) + 1
    INTO   v_next_num
    FROM   tickets
    WHERE  shop_id   = p_shop_id
      AND  barber_id = p_barber_id
      AND  created_at >= v_last_reset;

    -- Insert the new ticket
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


-- [2] get_people_ahead — total number of people waiting before a given ticket
CREATE OR REPLACE FUNCTION get_people_ahead(
    p_shop_id    UUID,
    p_barber_id  UUID,
    p_created_at TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COALESCE(SUM(people_count), 0)::INTEGER
    FROM   tickets
    WHERE  shop_id   = p_shop_id
      AND  barber_id = p_barber_id
      AND  status    = 'waiting'
      AND  created_at < p_created_at;
$$;


-- [3] get_queue_status_public — TV/kiosk display (returns NO PII)
CREATE OR REPLACE FUNCTION get_queue_status_public(p_shop_id UUID)
RETURNS TABLE (
    barber_id     UUID,
    barber_name   TEXT,
    ticket_number INTEGER,
    status        TEXT,
    people_count  INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT  t.barber_id,
            b.name,
            t.ticket_number,
            t.status,
            t.people_count
    FROM    tickets t
    JOIN    barbers b ON b.id = t.barber_id
    WHERE   t.shop_id = p_shop_id
      AND   t.status IN ('waiting', 'serving')
    ORDER BY t.barber_id, t.created_at ASC;
$$;


-- [4] process_next_customer — atomically serve the next waiting customer
--     • Completes any ticket currently 'serving' for this barber.
--     • Picks the oldest 'waiting' ticket assigned to the barber,
--       or falls back to unassigned tickets if none found.
CREATE OR REPLACE FUNCTION process_next_customer(
    p_barber_id UUID,
    p_shop_id   UUID
)
RETURNS TABLE (
    ticket_id     UUID,
    ticket_number INTEGER,
    customer_name TEXT,
    people_count  INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_ticket_id      UUID;
    v_ticket_number  INTEGER;
    v_customer_name  TEXT;
    v_people_count   INTEGER;
    v_current_serving UUID;
BEGIN
    -- Complete any ticket currently being served by this barber
    SELECT id INTO v_current_serving
    FROM   tickets
    WHERE  barber_id = p_barber_id
      AND  status    = 'serving'
    FOR UPDATE SKIP LOCKED;

    IF v_current_serving IS NOT NULL THEN
        UPDATE tickets
        SET    status = 'completed', updated_at = NOW()
        WHERE  id = v_current_serving;
    END IF;

    -- Try to pick the oldest waiting ticket assigned to this barber
    SELECT t.id, t.ticket_number, t.customer_name, t.people_count
    INTO   v_ticket_id, v_ticket_number, v_customer_name, v_people_count
    FROM   tickets t
    WHERE  t.shop_id   = p_shop_id
      AND  t.barber_id = p_barber_id
      AND  t.status    = 'waiting'
    ORDER  BY t.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT  1;

    -- Fall back to unassigned tickets
    IF v_ticket_id IS NULL THEN
        SELECT t.id, t.ticket_number, t.customer_name, t.people_count
        INTO   v_ticket_id, v_ticket_number, v_customer_name, v_people_count
        FROM   tickets t
        WHERE  t.shop_id   = p_shop_id
          AND  t.barber_id IS NULL
          AND  t.status    = 'waiting'
        ORDER  BY t.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT  1;
    END IF;

    IF v_ticket_id IS NULL THEN
        RAISE EXCEPTION 'no_customers_waiting';
    END IF;

    -- Mark chosen ticket as 'serving' and assign the barber
    UPDATE tickets
    SET    status    = 'serving',
           barber_id = p_barber_id,
           updated_at = NOW()
    WHERE  id = v_ticket_id;

    RETURN QUERY
        SELECT v_ticket_id, v_ticket_number, v_customer_name, v_people_count;
END;
$$;


-- ─── STEP 7: ROW LEVEL SECURITY ─────────────────────────────────────────────

ALTER TABLE shops   ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- ── SHOPS ─────────────────────────────────────────────────────────

-- Anyone can read shops (slug lookup, TV display, customer booking)
CREATE POLICY "shops_select_public"
    ON shops FOR SELECT USING (true);

-- Only the authenticated owner can create / modify / delete their shop
CREATE POLICY "shops_insert_owner"
    ON shops FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "shops_update_owner"
    ON shops FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "shops_delete_owner"
    ON shops FOR DELETE
    USING (auth.uid() = owner_id);

-- ── BARBERS ───────────────────────────────────────────────────────

-- Anyone can read barbers (shown to customers on booking page + TV)
CREATE POLICY "barbers_select_public"
    ON barbers FOR SELECT USING (true);

-- Only shop owner can add barbers to their shop
CREATE POLICY "barbers_insert_owner"
    ON barbers FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = barbers.shop_id
              AND shops.owner_id = auth.uid()
        )
    );

-- Shop owner OR the barber themselves can update
CREATE POLICY "barbers_update_owner_or_self"
    ON barbers FOR UPDATE
    USING (
        auth.uid() = barbers.auth_id
        OR EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = barbers.shop_id
              AND shops.owner_id = auth.uid()
        )
    );

-- Only shop owner can delete barbers
CREATE POLICY "barbers_delete_owner"
    ON barbers FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = barbers.shop_id
              AND shops.owner_id = auth.uid()
        )
    );

-- ── TICKETS ───────────────────────────────────────────────────────

-- Shop owner can read all tickets for their shop
CREATE POLICY "tickets_select_owner"
    ON tickets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = tickets.shop_id
              AND shops.owner_id = auth.uid()
        )
    );

-- Barbers can read all tickets in their shop
CREATE POLICY "tickets_select_barber"
    ON tickets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM barbers
            WHERE barbers.shop_id = tickets.shop_id
              AND barbers.auth_id = auth.uid()
        )
    );

-- Anonymous customer can read their own ticket by session_id
CREATE POLICY "tickets_select_own_session"
    ON tickets FOR SELECT
    USING (
        user_session_id IS NOT NULL
        AND user_session_id = COALESCE(
            current_setting('app.session_id', true), ''
        )
    );

-- INSERT is handled exclusively via the create_ticket RPC (SECURITY DEFINER).
-- This policy acts as a backstop: the shop must be open.
-- Note: the recursive self-check removed to avoid infinite recursion; the RPC
-- already enforces the one-active-ticket-per-session rule atomically.
CREATE POLICY "tickets_insert_open_shop"
    ON tickets FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = tickets.shop_id
              AND shops.is_open = true
        )
    );

-- Shop owner can update any ticket status (cancel, reassign, etc.)
CREATE POLICY "tickets_update_owner"
    ON tickets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = tickets.shop_id
              AND shops.owner_id = auth.uid()
        )
    );

-- Barbers can update tickets assigned to them
CREATE POLICY "tickets_update_barber"
    ON tickets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM barbers
            WHERE barbers.id      = tickets.barber_id
              AND barbers.auth_id = auth.uid()
        )
    );

-- Customers can cancel only their own active ticket
CREATE POLICY "tickets_update_own_cancel"
    ON tickets FOR UPDATE
    USING (
        user_session_id IS NOT NULL
        AND user_session_id = COALESCE(
            current_setting('app.session_id', true), ''
        )
        AND status IN ('waiting', 'serving')
    )
    WITH CHECK (status = 'canceled');

-- Only shop owner can hard-delete tickets
CREATE POLICY "tickets_delete_owner"
    ON tickets FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = tickets.shop_id
              AND shops.owner_id = auth.uid()
        )
    );


-- ─── STEP 8: GRANTS ─────────────────────────────────────────────────────────

GRANT USAGE  ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON shops   TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON barbers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tickets TO anon, authenticated;

GRANT EXECUTE ON FUNCTION create_ticket(UUID, UUID, TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_people_ahead(UUID, UUID, TIMESTAMPTZ)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_queue_status_public(UUID)                         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION process_next_customer(UUID, UUID)                     TO anon, authenticated;


-- ─── STEP 9: SUPABASE REALTIME ──────────────────────────────────────────────
--
-- IMPORTANT: After DROP TABLE + CREATE TABLE, the new tables are NOT in the
-- supabase_realtime publication and lose REPLICA IDENTITY FULL.
-- This step MUST be run so that postgres_changes subscriptions work.
--
-- REPLICA IDENTITY FULL means Postgres sends the full old + new row in the
-- WAL for UPDATE/DELETE, which is required for server-side column filters
-- (e.g. shop_id=eq.<uuid>) to work correctly.

ALTER TABLE tickets REPLICA IDENTITY FULL;
ALTER TABLE barbers REPLICA IDENTITY FULL;
ALTER TABLE shops   REPLICA IDENTITY FULL;

-- Add (or re-add) our tables to the Supabase realtime publication.
-- We use DO block to handle the case where the publication already covers
-- all tables (FOR ALL TABLES), in which case we skip gracefully.
DO $$
BEGIN
  -- Only add individual tables if the publication does NOT already cover
  -- all tables (i.e. not a FOR ALL TABLES publication).
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND puballtables = true
  ) THEN
    -- Remove stale entries first (in case of partial state), then re-add
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS tickets;
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS barbers;
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS shops;
    EXCEPTION WHEN undefined_object THEN NULL;
    END;

    ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
    ALTER PUBLICATION supabase_realtime ADD TABLE barbers;
    ALTER PUBLICATION supabase_realtime ADD TABLE shops;
  END IF;
END $$;


-- ─── DONE ────────────────────────────────────────────────────────────────────
-- Schema is ready. All previous patches are consolidated here.
-- Run this file ONCE in Supabase SQL Editor. Realtime is now active.
-- ─────────────────────────────────────────────────────────────────────────────
