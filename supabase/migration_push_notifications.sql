-- ============================================================
-- PUSH NOTIFICATIONS — Database Migration
-- ============================================================
-- Instructions:
--   1. FIRST: Generate VAPID keys in your terminal:
--        npx web-push generate-vapid-keys
--
--   2. Set the public key in the DB (run this in SQL Editor, replacing value):
--        ALTER DATABASE postgres SET "app.vapid_public_key" = 'YOUR_PUBLIC_KEY_HERE';
--
--   3. Set Edge Function secrets in Supabase Dashboard
--      (Settings → Edge Functions → Manage Secrets):
--        VAPID_PUBLIC_KEY  = <your-public-key>
--        VAPID_PRIVATE_KEY = <your-private-key>
--        VAPID_SUBJECT     = mailto:support@yourapp.com
--
--   4. Run this entire SQL file in the Supabase SQL Editor.
-- ============================================================


-- ─── 1. TABLE: push_subscriptions ────────────────────────────────────────────
--
-- Stores the Web Push subscription objects for each authenticated user.
-- A single user may have multiple subscriptions (one per device/browser).

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription JSONB       NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Prevent storing the same subscription endpoint twice for the same user
    UNIQUE (user_id, subscription)
);

-- Index for fast lookup by user_id (the Edge Function queries by user_id)
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions(user_id);


-- ─── 2. ROW LEVEL SECURITY ───────────────────────────────────────────────────

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read, insert, and delete their own subscriptions
DROP POLICY IF EXISTS "push_subs_select_own"  ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs_insert_own"  ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs_delete_own"  ON push_subscriptions;

CREATE POLICY "push_subs_select_own"
    ON push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "push_subs_insert_own"
    ON push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subs_delete_own"
    ON push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

-- Authenticated users can manage their own subscriptions
GRANT SELECT, INSERT, DELETE ON push_subscriptions TO authenticated;


-- ─── 3. RPC: get_vapid_public_key ────────────────────────────────────────────
--
-- Called by `usePushSubscription.ts` on the frontend to get the VAPID
-- public key without exposing it as a plain environment variable or hardcoding.
-- The key is read from a database-level config variable (set by ALTER DATABASE).
-- This is safe to expose publicly — the public key is designed to be shared.

CREATE OR REPLACE FUNCTION get_vapid_public_key()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT current_setting('app.vapid_public_key', true);
$$;

-- Allow both anonymous customers and authenticated barbers to call this
GRANT EXECUTE ON FUNCTION get_vapid_public_key() TO anon, authenticated;


-- ─── 4. SET THE VAPID PUBLIC KEY ─────────────────────────────────────────────
--
-- IMPORTANT: Replace 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY' with your actual
-- VAPID public key before running this script.
-- You can generate one using: npx web-push generate-vapid-keys

-- ALTER DATABASE postgres SET "app.vapid_public_key" = 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY';


-- ─── DONE ────────────────────────────────────────────────────────────────────
-- After running, set your Edge Function secrets and deploy the send-push function.
-- ─────────────────────────────────────────────────────────────────────────────
