// @deno-types="https://esm.sh/v135/web-push@3.6.6/index.d.ts"
import webpush from "https://esm.sh/web-push@3.6.6?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Define expected payload
interface PushPayload {
  userId: string;
  title: string;
  body: string;
  url?: string;
}

interface PushSubscriptionData {
  id: string;
  subscription: webpush.PushSubscription;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS Preflight Requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== "POST") {
      throw new Error(`Method ${req.method} not allowed.`);
    }

    // Initialize Supabase Client using Service Role Key
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the payload
    const payload: PushPayload = await req.json();

    if (!payload.userId || !payload.title || !payload.body) {
      return new Response(JSON.stringify({ error: "Missing required payload parameters: userId, title, body." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch VAPID keys from app_settings
    const { data: settingsData, error: settingsError } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"]);

    if (settingsError || !settingsData || settingsData.length < 2) {
      console.error("Error fetching VAPID keys:", settingsError?.message);
      throw new Error("VAPID keys not configured in the database.");
    }

    const vapidPublicKey = settingsData.find((s) => s.key === "VAPID_PUBLIC_KEY")?.value;
    const vapidPrivateKey = settingsData.find((s) => s.key === "VAPID_PRIVATE_KEY")?.value;

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID keys are missing from the app_settings table.");
    }

    // Configure web-push with VAPID details
    // Ensure you provide a contact email. Since we don't have one in DB, we use a placeholder or dynamic config.
    const contactEmail = Deno.env.get("VAPID_SUBJECT") || "mailto:support@example.com";
    webpush.setVapidDetails(contactEmail, vapidPublicKey, vapidPrivateKey);

    // Fetch user subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", payload.userId);

    if (subError) {
      console.error("Error fetching subscriptions:", subError.message);
      throw new Error("Failed to fetch user subscriptions.");
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No active subscriptions found for this user." }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/",
    });

    let successCount = 0;
    let failureCount = 0;

    // Dispatch notifications
    await Promise.all(
      subscriptions.map(async (subRow: PushSubscriptionData) => {
        try {
          await webpush.sendNotification(subRow.subscription, pushPayload);
          successCount++;
          return { success: true };
        } catch (error: any) {
          console.error(`Error sending to subscription ${subRow.id}:`, error.statusCode || error.message);

          // Handle Expired / Invalid Subscriptions (404 / 410)
          if (error.statusCode === 404 || error.statusCode === 410) {
            console.log(`Deleting expired subscription: ${subRow.id}`);
            await supabase.from("push_subscriptions").delete().eq("id", subRow.id);
          }

          failureCount++;
          return { success: false, error: error.message };
        }
      })
    );

    return new Response(
      JSON.stringify({
        message: "Push dispatch completed.",
        successCount,
        failureCount,
        totalAttempted: subscriptions.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (err: any) {
    console.error("Unhandled Edge Function error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
