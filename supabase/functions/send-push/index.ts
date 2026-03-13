// @deno-types="https://esm.sh/v135/web-push@3.6.6/index.d.ts"
import webpush from "https://esm.sh/web-push@3.6.6?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PushPayload {
  userId: string;
  title: string;
  body: string;
  url?: string;
}

interface PushSubscriptionRow {
  id: string;
  subscription: webpush.PushSubscription;
}

// ─── CORS Headers ────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Validate method ──────────────────────────────────────────────────
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: `Method ${req.method} not allowed.` }),
        { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ── 2. Read VAPID keys from Edge Function secrets (env vars) ───────────
    //
    // IMPORTANT: These must be set in the Supabase Dashboard under
    //   Settings → Edge Functions → Manage Secrets:
    //     VAPID_PUBLIC_KEY  = <your-vapid-public-key>
    //     VAPID_PRIVATE_KEY = <your-vapid-private-key>
    //     VAPID_SUBJECT     = mailto:support@yourapp.com
    //
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@coiffure.app";

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("[send-push] Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY env vars.");
      return new Response(
        JSON.stringify({ error: "Push notifications are not configured on the server." }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ── 3. Configure web-push ───────────────────────────────────────────────
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // ── 4. Parse and validate body ─────────────────────────────────────────
    let payload: PushPayload;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!payload.userId || !payload.title || !payload.body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, title, body." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ── 5. Initialize Supabase with Service Role Key ───────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 6. Fetch all subscriptions for this user ───────────────────────────
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", payload.userId);

    if (subError) {
      console.error("[send-push] Error fetching subscriptions:", subError.message);
      throw new Error("Failed to fetch push subscriptions.");
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active subscriptions found for this user.", successCount: 0, failureCount: 0, totalAttempted: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ── 7. Build the notification payload ─────────────────────────────────
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/",
    });

    // ── 8. Send to all subscriptions, clean up expired ones ───────────────
    let successCount = 0;
    let failureCount = 0;

    await Promise.all(
      (subscriptions as PushSubscriptionRow[]).map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription, notificationPayload);
          successCount++;
        } catch (err: any) {
          const status: number = err.statusCode ?? 0;
          console.warn(`[send-push] Failed for subscription ${row.id} — HTTP ${status}: ${err.message}`);

          // 404 / 410 = subscription is expired or invalid → delete it
          if (status === 404 || status === 410) {
            console.log(`[send-push] Removing expired subscription: ${row.id}`);
            await supabase.from("push_subscriptions").delete().eq("id", row.id);
          }

          failureCount++;
        }
      })
    );

    // ── 9. Return summary ──────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        message: "Push dispatch completed.",
        successCount,
        failureCount,
        totalAttempted: subscriptions.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (err: any) {
    console.error("[send-push] Unhandled error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
