import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PiMeResponse = {
  uid: string;
  username: string;
  wallet_address?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { accessToken } = await req.json();

    if (!accessToken || typeof accessToken !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing accessToken" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const piResponse = await fetch("https://api.minepi.com/v2/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!piResponse.ok) {
      const details = await piResponse.text();

      return new Response(
        JSON.stringify({
          error: "Pi verification failed",
          status: piResponse.status,
          details,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const piUser = (await piResponse.json()) as PiMeResponse;

    if (!piUser?.uid || !piUser?.username) {
      return new Response(
        JSON.stringify({ error: "Invalid Pi /me response" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase service role configuration" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date().toISOString();

    const { data, error } = await admin
      .from("pi_users")
      .upsert(
        {
          pi_uid: piUser.uid,
          username: piUser.username,
          wallet_address: piUser.wallet_address ?? null,
          raw_profile: piUser,
          last_authenticated_at: now,
          updated_at: now,
        },
        { onConflict: "pi_uid" }
      )
      .select("pi_uid, username, wallet_address, last_authenticated_at")
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        uid: data.pi_uid,
        username: data.username,
        walletAddress: data.wallet_address,
        authenticatedAt: data.last_authenticated_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected pi-auth error";

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
