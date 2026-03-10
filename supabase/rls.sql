-- ============================================================
-- BARBERTICKET — Row Level Security (RLS) Policies
-- Run after schema.sql in Supabase SQL Editor.
-- ============================================================

-- ─── ENABLE RLS ───────────────────────────────────────────

ALTER TABLE shops   ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- ─── SHOPS ────────────────────────────────────────────────

-- Public reads (shops list, slug lookup, TV display)
DROP POLICY IF EXISTS "Shops are viewable by everyone" ON shops;
CREATE POLICY "shops_select_public"
    ON shops FOR SELECT USING (true);

-- Only the authenticated owner can insert/update/delete
DROP POLICY IF EXISTS "Shops are insertable by owner" ON shops;
CREATE POLICY "shops_insert_owner"
    ON shops FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Shops are updatable by owner" ON shops;
CREATE POLICY "shops_update_owner"
    ON shops FOR UPDATE
    USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Shops are deletable by owner" ON shops;
CREATE POLICY "shops_delete_owner"
    ON shops FOR DELETE
    USING (auth.uid() = owner_id);

-- ─── BARBERS ──────────────────────────────────────────────

-- Public reads (barber list shown to customers + TV display)
DROP POLICY IF EXISTS "Barbers are viewable by everyone" ON barbers;
CREATE POLICY "barbers_select_public"
    ON barbers FOR SELECT USING (true);

-- Only shop owner can add/remove barbers
DROP POLICY IF EXISTS "Barbers are insertable by shop owner" ON barbers;
CREATE POLICY "barbers_insert_owner"
    ON barbers FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = barbers.shop_id
              AND shops.owner_id = auth.uid()
        )
    );

-- Shop owner OR the barber themselves can update (e.g. status toggle)
DROP POLICY IF EXISTS "Barbers are updatable by shop owner" ON barbers;
DROP POLICY IF EXISTS "Barbers can update their own profile" ON barbers;
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

DROP POLICY IF EXISTS "Barbers are deletable by shop owner" ON barbers;
CREATE POLICY "barbers_delete_owner"
    ON barbers FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = barbers.shop_id
              AND shops.owner_id = auth.uid()
        )
    );

-- ─── TICKETS ──────────────────────────────────────────────

-- Drop ALL old open policies first
DROP POLICY IF EXISTS "Tickets are viewable by everyone"  ON tickets;
DROP POLICY IF EXISTS "Tickets are insertable by anyone"  ON tickets;
DROP POLICY IF EXISTS "Tickets are updatable by shop owner" ON tickets;
DROP POLICY IF EXISTS "Tickets are deletable by shop owner" ON tickets;
DROP POLICY IF EXISTS "tickets_select_owner"              ON tickets;
DROP POLICY IF EXISTS "tickets_select_barber"             ON tickets;
DROP POLICY IF EXISTS "tickets_select_own_session"        ON tickets;
DROP POLICY IF EXISTS "tickets_insert_rate_limit"         ON tickets;

-- SELECT: shop owners see all tickets of their shop
CREATE POLICY "tickets_select_owner"
    ON tickets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = tickets.shop_id
              AND shops.owner_id = auth.uid()
        )
    );

-- SELECT: barbers see tickets in their shop
CREATE POLICY "tickets_select_barber"
    ON tickets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM barbers
            WHERE barbers.shop_id = tickets.shop_id
              AND barbers.auth_id = auth.uid()
        )
    );

-- SELECT: anonymous customer can read their own ticket by session_id
--   (frontend passes user_session_id as a WHERE filter; this policy acts as an additional guard)
CREATE POLICY "tickets_select_own_session"
    ON tickets FOR SELECT
    USING (
        user_session_id IS NOT NULL
        AND user_session_id = COALESCE(
            current_setting('app.session_id', true), ''
        )
    );

-- INSERT: rate-limit — one active ticket per session per shop, shop must be open
--   (the create_ticket RPC also enforces this at the function level)
CREATE POLICY "tickets_insert_rate_limit"
    ON tickets FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = tickets.shop_id AND shops.is_open = true
        )
        AND NOT EXISTS (
            SELECT 1 FROM tickets t2
            WHERE t2.shop_id        = tickets.shop_id
              AND t2.user_session_id = tickets.user_session_id
              AND t2.status          IN ('waiting', 'serving')
        )
    );

-- UPDATE: shop owner can change ticket status (cancel, serve, complete)
CREATE POLICY "tickets_update_owner"
    ON tickets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = tickets.shop_id
              AND shops.owner_id = auth.uid()
        )
    );

-- UPDATE: barbers can update status of tickets assigned to them
CREATE POLICY "tickets_update_barber"
    ON tickets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM barbers
            WHERE barbers.id      = tickets.barber_id
              AND barbers.auth_id = auth.uid()
        )
    );

-- UPDATE: customer can cancel their own ticket
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

-- DELETE: shop owner only
CREATE POLICY "tickets_delete_owner"
    ON tickets FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM shops
            WHERE shops.id = tickets.shop_id
              AND shops.owner_id = auth.uid()
        )
    );
