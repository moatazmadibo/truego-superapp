import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { rideId, paymentId, amountPi } = await req.json();

    if (!rideId || !paymentId) {
      return json({ error: "Missing rideId or paymentId" }, 400);
    }

    const piApiKey = Deno.env.get("PI_API_KEY");
    if (!piApiKey) {
      return json({ error: "Missing PI_API_KEY secret" }, 500);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existingRide, error: existingRideError } = await admin
      .from("rides")
      .select(
        "id, status, payment_status, payment_id, payment_txid, payment_amount_pi, payment_completed_at"
      )
      .eq("id", rideId)
      .single();

    if (existingRideError || !existingRide) {
      return json({ error: "Ride not found" }, 404);
    }

    if (
      existingRide.payment_status === "completed" ||
      existingRide.payment_completed_at
    ) {
      return json({
        ok: true,
        alreadyCompleted: true,
        ride: existingRide,
      });
    }

    if (
      existingRide.payment_status === "approved" &&
      existingRide.payment_id === paymentId
    ) {
      return json({
        ok: true,
        alreadyApproved: true,
        ride: existingRide,
      });
    }

    /*
      Important:
      If old payment_id is approved but has no txid/completed_at,
      it is only a stale approval attempt. Allow replacing it.
    */
    if (
      existingRide.payment_id &&
      existingRide.payment_id !== paymentId &&
      (existingRide.payment_txid || existingRide.payment_completed_at)
    ) {
      return json(
        {
          error: "Ride already has a blockchain-linked payment attempt",
          existingPaymentId: existingRide.payment_id,
          existingTxid: existingRide.payment_txid,
        },
        409
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
      await admin
        .from("rides")
        .update({
          payment_provider: "pi",
          payment_id: paymentId,
          payment_status: "failed",
          payment_amount_pi: amountPi ?? existingRide.payment_amount_pi ?? null,
          payment_last_error: `Pi approve failed: ${piResponse.status} ${piResponseText}`,
          payment_last_error_at: new Date().toISOString(),
        })
        .eq("id", rideId);

      return json(
        {
          error: "Pi approve failed",
          status: piResponse.status,
          details: piResponseText,
        },
        502
      );
    }

    const { data, error } = await admin
      .from("rides")
      .update({
        payment_provider: "pi",
        payment_id: paymentId,
        payment_txid: null,
        payment_status: "approved",
        payment_amount_pi: amountPi ?? existingRide.payment_amount_pi ?? null,
        payment_last_error: null,
        payment_last_error_at: null,
      })
      .eq("id", rideId)
      .select(
        "id, payment_status, payment_id, payment_txid, payment_amount_pi, payment_completed_at"
      )
      .single();

    if (error) {
      return json({ error: error.message }, 500);
    }

    return json({
      ok: true,
      ride: data,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected pi approve error";

    return json({ error: message }, 500);
  }
});
