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

function normalizeOtp(value: unknown) {
  return String(value ?? "").replace(/[^\d]/g, "").slice(0, 6);
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
    const otpSecret = Deno.env.get("OTP_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !otpSecret) {
      return jsonResponse({ error: "Email OTP verification is not configured." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const driverId = String(body.driverId ?? "").trim();
    const email = normalizeEmail(body.email);
    const otp = normalizeOtp(body.otp);

    if (!driverId) {
      return jsonResponse({ error: "Driver profile is required." }, 400);
    }

    if (!email) {
      return jsonResponse({ error: "Email is required." }, 400);
    }

    if (otp.length !== 6) {
      return jsonResponse({ error: "Enter the 6-digit OTP code." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });

    const { data: verification, error: lookupError } = await admin
      .from("contact_verifications")
      .select("id, otp_hash, attempts, expires_at")
      .eq("role", "driver")
      .eq("channel", "email")
      .eq("target", email)
      .eq("demo_driver_id", driverId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      return jsonResponse({ error: lookupError.message }, 500);
    }

    if (!verification) {
      return jsonResponse({ error: "OTP is expired or not found." }, 400);
    }

    if ((verification.attempts ?? 0) >= 5) {
      await admin
        .from("contact_verifications")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", verification.id);

      return jsonResponse({ error: "Too many OTP attempts. Request a new code." }, 429);
    }

    const otpHash = await sha256Hex(`${otp}:${otpSecret}`);

    if (otpHash !== verification.otp_hash) {
      const nextAttempts = (verification.attempts ?? 0) + 1;

      await admin
        .from("contact_verifications")
        .update({
          attempts: nextAttempts,
          status: nextAttempts >= 5 ? "failed" : "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", verification.id);

      return jsonResponse({ error: "Invalid OTP code." }, 400);
    }

    const now = new Date().toISOString();

    await admin
      .from("contact_verifications")
      .update({
        status: "verified",
        verified_at: now,
        updated_at: now,
      })
      .eq("id", verification.id);

    const { data: driver, error: updateError } = await admin
      .from("demo_drivers")
      .update({
        email_verified_at: now,
        updated_at: now,
      })
      .eq("id", driverId)
      .select("*")
      .single();

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({
      ok: true,
      driver,
      message: "Email verified successfully.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected OTP verification error.";
    return jsonResponse({ error: message }, 500);
  }
});