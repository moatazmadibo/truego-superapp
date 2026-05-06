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
    const { rideId, paymentId, txid, amountPi } = await req.json();

    if (!rideId || !paymentId || !txid) {
      return json({ error: "Missing rideId, paymentId, or txid" }, 400);
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

    /*
      If there is an old approved payment_id without txid,
      allow this completion call to replace it.
      If there is already a different txid, block to avoid mixing payments.
    */
    if (
      existingRide.payment_id &&
      existingRide.payment_id !== paymentId &&
      existingRide.payment_txid &&
      existingRide.payment_txid !== txid
    ) {
      return json(
        {
          error: "Ride already has a different blockchain transaction",
          existingPaymentId: existingRide.payment_id,
          existingTxid: existingRide.payment_txid,
        },
        409
      );
    }

    /*
      Save payment_id + txid before contacting Pi complete.
      This protects us from Payment Verification Failed screens:
      the app will not lose the txid and will not ask the rider to pay again.
    */
    const { data: recordedRide, error: recordError } = await admin
      .from("rides")
      .update({
        payment_provider: "pi",
        payment_id: paymentId,
        payment_txid: txid,
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

    if (recordError) {
      return json({ error: recordError.message }, 500);
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
      const details = `Pi complete verification failed: ${piResponse.status} ${piResponseText}`;

      const { data: pendingRide } = await admin
        .from("rides")
        .update({
          payment_provider: "pi",
          payment_id: paymentId,
          payment_txid: txid,
          payment_status: "approved",
          payment_amount_pi: amountPi ?? existingRide.payment_amount_pi ?? null,
          payment_last_error: details,
          payment_last_error_at: new Date().toISOString(),
        })
        .eq("id", rideId)
        .select(
          "id, payment_status, payment_id, payment_txid, payment_amount_pi, payment_completed_at"
        )
        .single();

      return json({
        ok: false,
        pendingVerification: true,
        error: "Pi complete verification failed",
        status: piResponse.status,
        details: piResponseText,
        ride: pendingRide ?? recordedRide,
      });
    }

    const { data, error } = await admin
      .from("rides")
      .update({
        payment_provider: "pi",
        payment_id: paymentId,
        payment_txid: txid,
        payment_status: "completed",
        payment_amount_pi: amountPi ?? existingRide.payment_amount_pi ?? null,
        payment_completed_at: new Date().toISOString(),
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
      error instanceof Error ? error.message : "Unexpected pi complete error";

    return json({ error: message }, 500);
  }
});
