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
    const { rideId, paymentId, txid, amountPi } = await req.json();

    if (!rideId || !paymentId || !txid) {
      return new Response(
        JSON.stringify({ error: "Missing rideId, paymentId, or txid" }),
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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existingRide, error: existingRideError } = await admin
      .from("rides")
      .select(
        "id, payment_status, payment_id, payment_txid, payment_amount_pi, payment_completed_at"
      )
      .eq("id", rideId)
      .single();

    if (existingRideError || !existingRide) {
      return new Response(
        JSON.stringify({ error: "Ride not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (existingRide.payment_status === "completed") {
      return new Response(
        JSON.stringify({
          ok: true,
          alreadyCompleted: true,
          ride: existingRide,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (
      existingRide.payment_id &&
      existingRide.payment_id !== paymentId &&
      ["approved", "completed"].includes(existingRide.payment_status ?? "")
    ) {
      return new Response(
        JSON.stringify({
          error: "Ride already linked to a different payment",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const piResponse = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          authorization: `key ${piApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txid }),
      }
    );

    const piResponseText = await piResponse.text();

    if (!piResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Pi complete failed",
          status: piResponse.status,
          details: piResponseText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data, error } = await admin
      .from("rides")
      .update({
        payment_provider: "pi",
        payment_id: paymentId,
        payment_txid: txid,
        payment_status: "completed",
        payment_amount_pi: amountPi ?? null,
        payment_completed_at: new Date().toISOString(),
      })
      .eq("id", rideId)
      .select(
        "id, payment_status, payment_id, payment_txid, payment_amount_pi, payment_completed_at"
      )
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
      error instanceof Error ? error.message : "Unexpected pi complete error";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
