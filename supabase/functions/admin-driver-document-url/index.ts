import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestBody = {
  sessionToken?: string;
  filePath?: string;
  recordId?: string;
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

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service role configuration is missing.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
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

async function assertValidAdminSession(adminClient: ReturnType<typeof createClient>, token: string) {
  const hash = await sha256Hex(token);

  const { data, error } = await adminClient
    .from("admin_sessions")
    .select("id")
    .eq("session_token_hash", hash)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data?.id) {
    throw new Error("Invalid or expired admin session.");
  }

  await adminClient
    .from("admin_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);

  return data.id as string;
}

async function writeAuditLog(
  adminClient: ReturnType<typeof createClient>,
  input: {
    sessionId: string;
    recordId: string;
    filePath: string;
  }
) {
  await adminClient.from("admin_audit_logs").insert({
    source: "admin-driver-document-url",
    actor: `admin-session:${input.sessionId}`,
    action: "ADMIN_VIEW_DRIVER_DOCUMENT",
    table_name: "demo_driver_documents",
    record_id: input.recordId,
    summary: "Admin generated a signed URL for a driver document.",
    new_data: {
      file_path: input.filePath,
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
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const sessionToken = body.sessionToken?.trim() ?? "";
    const filePath = body.filePath?.trim() ?? "";
    const recordId = body.recordId?.trim() || filePath;

    if (!sessionToken) {
      throw new Error("Admin session token is required.");
    }

    if (!filePath) {
      throw new Error("Document file path is required.");
    }

    const adminClient = getAdminClient();
    const sessionId = await assertValidAdminSession(adminClient, sessionToken);

    const { data, error } = await adminClient.storage
      .from("driver-documents")
      .createSignedUrl(filePath, 60 * 10);

    if (error || !data?.signedUrl) {
      throw error ?? new Error("Failed to create signed URL.");
    }

    await writeAuditLog(adminClient, {
      sessionId,
      recordId,
      filePath,
    });

    return jsonResponse({
      ok: true,
      signedUrl: data.signedUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to open driver document.";

    return jsonResponse(
      {
        ok: false,
        error: message,
      },
      400
    );
  }
});
