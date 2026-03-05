-- Drop the old policy if it exists
DROP POLICY IF EXISTS "Tickets are viewable by shop owner or session owner" ON tickets;
DROP POLICY IF EXISTS "Tickets are viewable by everyone" ON tickets;

-- Create the new, open SELECT policy for tickets
CREATE POLICY "Tickets are viewable by everyone" 
    ON tickets FOR SELECT 
    USING (true);

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
