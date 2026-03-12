-- ============================================================
-- BARBERTICKET — Complete Database Schema
-- Run once in Supabase SQL Editor to initialize the project.
-- ============================================================

-- ─── EXTENSIONS ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── TABLES ───────────────────────────────────────────────

-- Shops
CREATE TABLE IF NOT EXISTS shops (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slug          TEXT        UNIQUE NOT NULL,
    name          TEXT        NOT NULL,
    logo_url      TEXT,
    maps_url      TEXT,
    phone         TEXT,
    is_open       BOOLEAN     DEFAULT true,
    last_reset_at TIMESTAMPTZ DEFAULT NOW(),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Barbers
CREATE TABLE IF NOT EXISTS barbers (
    id        UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id   UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    auth_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    name      TEXT        NOT NULL,
    is_active BOOLEAN     DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id         UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    barber_id       UUID        REFERENCES barbers(id) ON DELETE SET NULL,
    customer_name   TEXT        NOT NULL,
    phone_number    TEXT        NOT NULL,
    people_count    INTEGER     DEFAULT 1,
    ticket_number   INTEGER     NOT NULL,
    user_session_id TEXT        NOT NULL,
    status          TEXT        NOT NULL CHECK (status IN ('waiting', 'serving', 'completed', 'canceled')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_shops_owner_id    ON shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_shops_slug        ON shops(slug);
CREATE INDEX IF NOT EXISTS idx_barbers_shop_id   ON barbers(shop_id);
CREATE INDEX IF NOT EXISTS idx_tickets_shop_id   ON tickets(shop_id);
CREATE INDEX IF NOT EXISTS idx_tickets_barber_id ON tickets(barber_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status    ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_session   ON tickets(user_session_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created   ON tickets(created_at);

-- Safety-net unique constraint: no duplicate ticket numbers per barber
CREATE UNIQUE INDEX IF NOT EXISTS tickets_unique_number
    ON tickets (shop_id, barber_id, ticket_number)
    WHERE status != 'canceled';

-- ─── TRIGGERS ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ─── STORED FUNCTIONS ─────────────────────────────────────

-- [1] Atomic ticket creation (prevents race conditions on ticket_number)
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
    PERFORM pg_advisory_xact_lock(
        hashtext(p_shop_id::text || p_barber_id::text)
    );

    IF NOT EXISTS (SELECT 1 FROM shops WHERE id = p_shop_id AND is_open = true) THEN
        RAISE EXCEPTION 'shop_closed';
    END IF;

    IF p_phone IS NULL OR btrim(p_phone) = '' THEN
        RAISE EXCEPTION 'invalid_phone';
    END IF;

    IF p_phone !~ '^0[567][0-9]{8}$' THEN
        RAISE EXCEPTION 'invalid_phone';
    END IF;

    IF EXISTS (
        SELECT 1 FROM tickets
        WHERE shop_id = p_shop_id
          AND user_session_id = p_session_id
          AND status IN ('waiting', 'serving')
    ) THEN
        RAISE EXCEPTION 'duplicate_active_ticket';
    END IF;

    SELECT COALESCE(last_reset_at, date_trunc('day', now()))
    INTO v_last_reset FROM shops WHERE id = p_shop_id;

    IF date(v_last_reset) < current_date THEN
        v_last_reset := date_trunc('day', now());
    END IF;

    SELECT COALESCE(MAX(ticket_number), 0) + 1
    INTO v_next_num FROM tickets
    WHERE shop_id   = p_shop_id
      AND barber_id = p_barber_id
      AND created_at >= v_last_reset;

    INSERT INTO tickets (
        shop_id, barber_id, customer_name,
        phone_number, people_count, ticket_number,
        user_session_id, status
    ) VALUES (
        p_shop_id, p_barber_id, p_name,
        p_phone, p_people, v_next_num,
        p_session_id, 'waiting'
    ) RETURNING * INTO v_new_ticket;

    RETURN NEXT v_new_ticket;
END;
$$;

-- [2] Server-side "people ahead" aggregation (avoids fetching all rows to the frontend)
CREATE OR REPLACE FUNCTION get_people_ahead(
    p_shop_id    UUID,
    p_barber_id  UUID,
    p_created_at TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COALESCE(SUM(people_count), 0)::INTEGER
    FROM tickets
    WHERE shop_id    = p_shop_id
      AND barber_id  = p_barber_id
      AND status     = 'waiting'
      AND created_at < p_created_at;
$$;

-- [3] Public queue status for TV display (returns NO PII)
CREATE OR REPLACE FUNCTION get_queue_status_public(p_shop_id UUID)
RETURNS TABLE (
    barber_id     UUID,
    barber_name   TEXT,
    ticket_number INTEGER,
    status        TEXT,
    people_count  INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT t.barber_id, b.name, t.ticket_number, t.status, t.people_count
    FROM tickets t
    JOIN barbers b ON b.id = t.barber_id
    WHERE t.shop_id = p_shop_id
      AND t.status  IN ('waiting', 'serving')
    ORDER BY t.barber_id, t.created_at ASC;
$$;

-- [4] Process next customer for a barber (atomic, race-condition safe)
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
LANGUAGE plpgsql AS $$
DECLARE
    v_ticket_id      UUID;
    v_ticket_number  INTEGER;
    v_customer_name  TEXT;
    v_people_count   INTEGER;
    v_current_serving UUID;
BEGIN
    SELECT id INTO v_current_serving FROM tickets
    WHERE barber_id = p_barber_id AND status = 'serving'
    FOR UPDATE SKIP LOCKED;

    IF v_current_serving IS NOT NULL THEN
        UPDATE tickets SET status = 'completed', updated_at = NOW()
        WHERE id = v_current_serving;
    END IF;

    SELECT tickets.id, tickets.ticket_number, tickets.customer_name, tickets.people_count
    INTO v_ticket_id, v_ticket_number, v_customer_name, v_people_count
    FROM tickets
    WHERE shop_id = p_shop_id AND barber_id = p_barber_id AND status = 'waiting'
    ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1;

    IF v_ticket_id IS NULL THEN
        SELECT tickets.id, tickets.ticket_number, tickets.customer_name, tickets.people_count
        INTO v_ticket_id, v_ticket_number, v_customer_name, v_people_count
        FROM tickets
        WHERE shop_id = p_shop_id AND barber_id IS NULL AND status = 'waiting'
        ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1;
    END IF;

    IF v_ticket_id IS NOT NULL THEN
        UPDATE tickets SET status = 'serving', barber_id = p_barber_id, updated_at = NOW()
        WHERE id = v_ticket_id;
        RETURN QUERY SELECT v_ticket_id, v_ticket_number, v_customer_name, v_people_count;
    ELSE
        RAISE EXCEPTION 'no customers waiting';
    END IF;
END;
$$;

-- ─── GRANTS ───────────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON shops   TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON barbers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tickets TO anon, authenticated;

GRANT EXECUTE ON FUNCTION create_ticket(UUID, UUID, TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_people_ahead(UUID, UUID, TIMESTAMPTZ)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_queue_status_public(UUID)                        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION process_next_customer(UUID, UUID)                    TO anon, authenticated;
