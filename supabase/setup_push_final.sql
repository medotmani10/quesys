-- ============================================================
-- PUSH NOTIFICATIONS — Final Setup SQL
-- Run this ONCE in Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── 1. app_settings table (for VAPID keys) ──────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
    key   VARCHAR PRIMARY KEY,
    value VARCHAR NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage app_settings" ON public.app_settings;
CREATE POLICY "Service role can manage app_settings"
    ON public.app_settings AS PERMISSIVE FOR ALL
    TO service_role USING (true) WITH CHECK (true);


-- ─── 2. push_subscriptions table ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      VARCHAR     NOT NULL,
    subscription JSONB       NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_subscription UNIQUE (user_id, subscription)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert a push subscription"    ON public.push_subscriptions;
DROP POLICY IF EXISTS "Service role can read subscriptions"      ON public.push_subscriptions;
DROP POLICY IF EXISTS "Service role can delete subscriptions"    ON public.push_subscriptions;

CREATE POLICY "Anyone can insert a push subscription"
    ON public.push_subscriptions AS PERMISSIVE FOR INSERT
    TO public WITH CHECK (true);

CREATE POLICY "Service role can read subscriptions"
    ON public.push_subscriptions AS PERMISSIVE FOR SELECT
    TO service_role USING (true);

CREATE POLICY "Service role can delete subscriptions"
    ON public.push_subscriptions AS PERMISSIVE FOR DELETE
    TO service_role USING (true);


-- ─── 3. get_vapid_public_key() RPC ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_vapid_public_key()
RETURNS VARCHAR LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_public_key VARCHAR;
BEGIN
    SELECT value INTO v_public_key
    FROM public.app_settings WHERE key = 'VAPID_PUBLIC_KEY';

    IF v_public_key IS NULL THEN
        RAISE EXCEPTION 'VAPID_PUBLIC_KEY not found in app_settings';
    END IF;

    RETURN v_public_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vapid_public_key() TO anon, authenticated;


-- ─── 4. INSERT the generated VAPID keys ──────────────────────
INSERT INTO public.app_settings (key, value) VALUES
    ('VAPID_PUBLIC_KEY',  'BPZptzzvbt1TaiXC203urUfnAP95_1vRJUMQI9zj3xsFMktePxeQjJ2L14rizdaB6W6zd2I-B_z-btTA5mu-MAE'),
    ('VAPID_PRIVATE_KEY', 'wndt3Rb0nNQhKIDYmE1nMnM1T0waVVpZNe2H3kOQ8-g')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ─── DONE ─────────────────────────────────────────────────────
SELECT 'Push notifications setup complete! ✅' AS status;
