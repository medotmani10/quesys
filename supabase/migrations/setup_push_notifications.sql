-- ============================================================
-- Web Push Notifications Setup
-- ============================================================

-- 1. Create app_settings table to securely store VAPID keys
CREATE TABLE IF NOT EXISTS public.app_settings (
    key VARCHAR PRIMARY KEY,
    value VARCHAR NOT NULL
);

-- Protect app_settings table: Only service_role can read all keys.
-- The public VAPID key will be exposed via a specific RPC function.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (implicitly granted by bypassrls, but good to be explicit for policies if needed)
CREATE POLICY "Service role can manage app_settings"
    ON public.app_settings
    AS PERMISSIVE
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Create push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR NOT NULL, -- Using VARCHAR to support session IDs, UUIDs, or custom identifiers
    subscription JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_subscription UNIQUE (user_id, subscription)
);

-- Enable RLS on push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own subscriptions (assuming user_id is passed and validated or anonymous allowed based on use case)
-- In a fully authenticated system, this would check auth.uid() = user_id::uuid.
-- Since user_id can be a VARCHAR session ID, we'll allow anonymous/authenticated inserts, but restrict selects.
CREATE POLICY "Anyone can insert a push subscription"
    ON public.push_subscriptions
    AS PERMISSIVE
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Restrict SELECT to service_role (for the Edge Function to read and send notifications)
CREATE POLICY "Service role can read subscriptions"
    ON public.push_subscriptions
    AS PERMISSIVE
    FOR SELECT
    TO service_role
    USING (true);

-- Allow service_role to delete expired subscriptions
CREATE POLICY "Service role can delete subscriptions"
    ON public.push_subscriptions
    AS PERMISSIVE
    FOR DELETE
    TO service_role
    USING (true);

-- 3. Create RPC function to get the VAPID Public Key securely
CREATE OR REPLACE FUNCTION public.get_vapid_public_key()
RETURNS VARCHAR
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_public_key VARCHAR;
BEGIN
    SELECT value INTO v_public_key
    FROM public.app_settings
    WHERE key = 'VAPID_PUBLIC_KEY';

    IF v_public_key IS NULL THEN
        RAISE EXCEPTION 'VAPID_PUBLIC_KEY not found in app_settings';
    END IF;

    RETURN v_public_key;
END;
$$;

-- Grant execution to public so frontend can fetch it
GRANT EXECUTE ON FUNCTION public.get_vapid_public_key() TO anon, authenticated;

-- ============================================================
-- MANUAL STEPS AFTER RUNNING THIS MIGRATION:
-- You need to generate VAPID keys and insert them into app_settings:
--
-- INSERT INTO public.app_settings (key, value) VALUES
-- ('VAPID_PUBLIC_KEY', 'YOUR_PUBLIC_KEY_HERE'),
-- ('VAPID_PRIVATE_KEY', 'YOUR_PRIVATE_KEY_HERE');
-- ============================================================
