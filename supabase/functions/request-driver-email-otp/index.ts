import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function generateOtp() {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return String(100000 + (random[0] % 900000));
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const otpSecret = Deno.env.get("OTP_SECRET");
    const emailFrom = Deno.env.get("TRUEGO_EMAIL_FROM");

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !otpSecret || !emailFrom) {
      return jsonResponse({ error: "Email OTP service is not configured." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const driverId = String(body.driverId ?? "").trim();
    const email = normalizeEmail(body.email);
    const piUid = body.piUid ? String(body.piUid).trim() : null;

    if (!driverId) {
      return jsonResponse({ error: "Driver profile is required." }, 400);
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Valid email is required." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });

    const { data: driver, error: driverError } = await admin
      .from("demo_drivers")
      .select("id, display_name, email, pi_uid")
      .eq("id", driverId)
      .maybeSingle();

    if (driverError) {
      return jsonResponse({ error: driverError.message }, 500);
    }

    if (!driver) {
      return jsonResponse({ error: "Driver profile not found." }, 404);
    }

    const savedEmail = normalizeEmail(driver.email);
    if (savedEmail !== email) {
      return jsonResponse(
        { error: "Save the contact profile with this email before requesting OTP." },
        400
      );
    }

    const { data: latestPending } = await admin
      .from("contact_verifications")
      .select("id, created_at")
      .eq("role", "driver")
      .eq("channel", "email")
      .eq("target", email)
      .eq("demo_driver_id", driverId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestPending?.created_at) {
      const secondsSinceLastRequest =
        (Date.now() - new Date(latestPending.created_at).getTime()) / 1000;

      if (secondsSinceLastRequest < 60) {
        return jsonResponse(
          { error: "Please wait before requesting another email OTP." },
          429
        );
      }
    }

    await admin
      .from("contact_verifications")
      .update({
        status: "expired",
        updated_at: new Date().toISOString(),
      })
      .eq("role", "driver")
      .eq("channel", "email")
      .eq("target", email)
      .eq("demo_driver_id", driverId)
      .eq("status", "pending");

    const otp = generateOtp();
    const otpHash = await sha256Hex(`${otp}:${otpSecret}`);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: verification, error: insertError } = await admin
      .from("contact_verifications")
      .insert({
        role: "driver",
        channel: "email",
        target: email,
        pi_uid: piUid ?? driver.pi_uid ?? null,
        demo_driver_id: driverId,
        provider: "resend",
        otp_hash: otpHash,
        status: "pending",
        attempts: 0,
        expires_at: expiresAt,
      })
      .select("id, expires_at")
      .single();

    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500);
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [email],
        subject: "Your TrueGo driver verification code",
        text: `Your TrueGo driver verification code is ${otp}. It expires in 10 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>TrueGo Driver Email Verification</h2>
            <p>Your verification code is:</p>
            <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
            <p>This code expires in 10 minutes.</p>
            <p>If you did not request this code, you can ignore this email.</p>
          </div>
        `,
      }),
    });

    const resendBody = await resendResponse.json().catch(() => ({}));

    if (!resendResponse.ok) {
      await admin
        .from("contact_verifications")
        .update({
          status: "failed",
          provider_reference: JSON.stringify(resendBody).slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", verification.id);

      return jsonResponse({ error: "Failed to send email OTP." }, 502);
    }

    await admin
      .from("contact_verifications")
      .update({
        provider_reference:
          typeof resendBody?.id === "string" ? resendBody.id : JSON.stringify(resendBody).slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", verification.id);

    return jsonResponse({
      ok: true,
      expiresAt: verification.expires_at,
      message: "Email OTP sent.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected email OTP error.";
    return jsonResponse({ error: message }, 500);
  }
});