-- BarberQueue Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Shops table
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    logo_url TEXT,
    maps_url TEXT,
    phone TEXT,
    is_open BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Barbers table (The Chairs)
CREATE TABLE IF NOT EXISTS barbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    people_count INTEGER DEFAULT 1,
    ticket_number INTEGER NOT NULL,
    user_session_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('waiting', 'serving', 'completed', 'canceled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops(slug);
CREATE INDEX IF NOT EXISTS idx_barbers_shop_id ON barbers(shop_id);
CREATE INDEX IF NOT EXISTS idx_tickets_shop_id ON tickets(shop_id);
CREATE INDEX IF NOT EXISTS idx_tickets_barber_id ON tickets(barber_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_user_session ON tickets(user_session_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Shops RLS policies
CREATE POLICY "Shops are viewable by everyone" 
    ON shops FOR SELECT 
    USING (true);

CREATE POLICY "Shops are insertable by owner" 
    ON shops FOR INSERT 
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Shops are updatable by owner" 
    ON shops FOR UPDATE 
    USING (auth.uid() = owner_id);

CREATE POLICY "Shops are deletable by owner" 
    ON shops FOR DELETE 
    USING (auth.uid() = owner_id);

-- Barbers RLS policies
CREATE POLICY "Barbers are viewable by everyone" 
    ON barbers FOR SELECT 
    USING (true);

CREATE POLICY "Barbers are insertable by shop owner" 
    ON barbers FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM shops 
            WHERE shops.id = barbers.shop_id 
            AND shops.owner_id = auth.uid()
        )
    );

CREATE POLICY "Barbers are updatable by shop owner" 
    ON barbers FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM shops 
            WHERE shops.id = barbers.shop_id 
            AND shops.owner_id = auth.uid()
        )
    );

CREATE POLICY "Barbers are deletable by shop owner" 
    ON barbers FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM shops 
            WHERE shops.id = barbers.shop_id 
            AND shops.owner_id = auth.uid()
        )
    );

-- Tickets RLS policies
CREATE POLICY "Tickets are viewable by everyone" 
    ON tickets FOR SELECT 
    USING (true);

CREATE POLICY "Tickets are insertable by anyone" 
    ON tickets FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Tickets are updatable by shop owner" 
    ON tickets FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM shops 
            WHERE shops.id = tickets.shop_id 
            AND shops.owner_id = auth.uid()
        )
    );

CREATE POLICY "Tickets are deletable by shop owner" 
    ON tickets FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM shops 
            WHERE shops.id = tickets.shop_id 
            AND shops.owner_id = auth.uid()
        )
    );

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to get next ticket number (per shop per day)
CREATE OR REPLACE FUNCTION get_next_ticket_number(p_shop_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_next_number INTEGER;
    v_today DATE;
BEGIN
    v_today := CURRENT_DATE;
    
    SELECT COALESCE(MAX(ticket_number), 0) + 1
    INTO v_next_number
    FROM tickets
    WHERE shop_id = p_shop_id
    AND DATE(created_at) = v_today;
    
    RETURN v_next_number;
END;
$$ LANGUAGE plpgsql;

-- Function to process next customer (handles race conditions)
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
    SELECT id INTO v_current_serving
    FROM tickets
    WHERE barber_id = p_barber_id
    AND status = 'serving'
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

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STORAGE
-- ============================================

-- Create storage bucket for shop logos (run this in Storage section)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('shop-logos', 'shop-logos', true);

-- Storage RLS policies (run after creating bucket)
-- CREATE POLICY "Shop logos are viewable by everyone" 
--     ON storage.objects FOR SELECT 
--     USING (bucket_id = 'shop-logos');

-- CREATE POLICY "Shop logos are uploadable by authenticated users" 
--     ON storage.objects FOR INSERT 
--     WITH CHECK (bucket_id = 'shop-logos' AND auth.role() = 'authenticated');

-- ============================================
-- GRANTS & PERMISSIONS
-- ============================================

-- Ensure the anon and authenticated roles have access to the public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant privileges for shops
GRANT SELECT, INSERT, UPDATE, DELETE ON shops TO anon, authenticated;

-- Grant privileges for barbers
GRANT SELECT, INSERT, UPDATE, DELETE ON barbers TO anon, authenticated;

-- Grant privileges for tickets
GRANT SELECT, INSERT, UPDATE, DELETE ON tickets TO anon, authenticated;

-- Grant execute privileges on functions
GRANT EXECUTE ON FUNCTION get_next_ticket_number(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION process_next_customer(UUID, UUID) TO anon, authenticated;
