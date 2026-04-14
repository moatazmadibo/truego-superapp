import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { rideId, paymentId, amountPi } = await req.json();

    if (!rideId || !paymentId) {
      return new Response(
        JSON.stringify({ error: "Missing rideId or paymentId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const piApiKey = Deno.env.get("PI_API_KEY");
    if (!piApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing PI_API_KEY secret" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const piResponse = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          authorization: `key ${piApiKey}`,
        },
      }
    );

    const piResponseText = await piResponse.text();

    if (!piResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Pi approve failed",
          status: piResponse.status,
          details: piResponseText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await admin
      .from("rides")
      .update({
        payment_provider: "pi",
        payment_id: paymentId,
        payment_status: "approved",
        payment_amount_pi: amountPi ?? null,
      })
      .eq("id", rideId)
      .select("id, payment_status, payment_id, payment_amount_pi")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        ride: data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected pi approve error";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
