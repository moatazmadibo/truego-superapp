import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type VerifyBody = {
  accessCode?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createAdminSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function writeAuditLog(input: {
  action: string;
  summary: string;
  actor?: string | null;
  ok?: boolean;
  sessionId?: string | null;
}) {
  const adminClient = getAdminClient();

  if (!adminClient) {
    return;
  }

  await adminClient.from("admin_audit_logs").insert({
    source: "admin-access-verify",
    actor: input.actor ?? "admin-access-gate",
    action: input.action,
    table_name: "admin_access",
    record_id: input.sessionId ?? (input.ok ? "success" : "failed"),
    summary: input.summary,
    new_data: {
      ok: input.ok ?? false,
      event: input.action,
      session_id: input.sessionId ?? null,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const expectedCode = Deno.env.get("TRUEGO_ADMIN_ACCESS_CODE")?.trim();

    if (!expectedCode) {
      await writeAuditLog({
        action: "ADMIN_ACCESS_CONFIG_ERROR",
        summary: "Admin access secret is missing in Supabase Edge Function.",
        ok: false,
      });

      return jsonResponse(
        {
          ok: false,
          error: "Admin access is not configured on the server.",
        },
        500
      );
    }

    const body = (await req.json().catch(() => ({}))) as VerifyBody;
    const accessCode = body.accessCode?.trim() ?? "";

    if (!accessCode || accessCode !== expectedCode) {
      await writeAuditLog({
        action: "ADMIN_ACCESS_DENIED",
        summary: "Invalid admin access code attempt.",
        ok: false,
      });

      return jsonResponse(
        {
          ok: false,
          error: "Invalid admin access code.",
        },
        401
      );
    }

    const adminClient = getAdminClient();

    if (!adminClient) {
      throw new Error("Supabase service role configuration is missing.");
    }

    const sessionToken = createAdminSessionToken();
    const sessionTokenHash = await sha256Hex(sessionToken);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

    const { data: sessionRow, error: sessionError } = await adminClient
      .from("admin_sessions")
      .insert({
        session_token_hash: sessionTokenHash,
        actor: "admin-access-gate",
        status: "active",
        expires_at: expiresAt,
        last_seen_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (sessionError) {
      throw sessionError;
    }

    await writeAuditLog({
      action: "ADMIN_ACCESS_GRANTED",
      summary: "Admin access granted and server-side admin session created.",
      ok: true,
      sessionId: sessionRow?.id ?? null,
    });

    return jsonResponse({
      ok: true,
      sessionToken,
      expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin access verification failed.";

    await writeAuditLog({
      action: "ADMIN_ACCESS_ERROR",
      summary: message,
      ok: false,
    });

    return jsonResponse(
      {
        ok: false,
        error: message,
      },
      500
    );
  }
});
