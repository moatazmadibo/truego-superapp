import { useEffect, useMemo, useState } from "react";
import { initPiSdk, isPiSdkAvailable } from "../../lib/pi";
import type { PiAuthResult, PiPayment } from "../../types/pi-sdk";

const DEBUG_AMOUNT_PI = 0.00002062;
const DEFAULT_DEBUG_RIDE_ID = "8d9c08c4-1523-45db-b1fb-d9a586f75952";

function summarizePayment(payment?: PiPayment) {
  if (!payment) {
    return null;
  }

  return {
    identifier: payment.identifier,
    amount: payment.amount,
    memo: payment.memo,
    metadata: payment.metadata,
    user_uid: payment.user_uid,
    created_at: payment.created_at,
    transaction: payment.transaction,
    status: payment.status,
  };
}

function summarizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    raw: String(error),
  };
}

async function callEdgeFunctionRaw(
  functionName: string,
  body: Record<string, unknown>
) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!supabaseUrl || !anonKey) {
    return {
      ok: false,
      status: 0,
      body: {
        error: "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in build",
      },
    };
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  let parsedBody: unknown = text;
  try {
    parsedBody = JSON.parse(text);
  } catch {
    // Keep raw text.
  }

  return {
    ok: response.ok,
    status: response.status,
    body: parsedBody,
  };
}

export default function PiDebug() {
  const queryRideId = useMemo(() => {
    if (typeof window === "undefined") {
      return DEFAULT_DEBUG_RIDE_ID;
    }

    const params = new URLSearchParams(window.location.search);
    return params.get("rideId") ?? DEFAULT_DEBUG_RIDE_ID;
  }, []);

  const [logs, setLogs] = useState<string[]>([]);
  const [authResult, setAuthResult] = useState<PiAuthResult | null>(null);
  const [rideId, setRideId] = useState(queryRideId);

  function log(message: string, data?: unknown) {
    const safeData =
      data === undefined
        ? ""
        : (() => {
            try {
              return JSON.stringify(data);
            } catch {
              return String(data);
            }
          })();

    const line = safeData ? `${message}: ${safeData}` : message;

    setLogs((current) => [`${new Date().toISOString()} ${line}`, ...current]);
    console.log("[PiDebug]", message, data ?? "");
  }

  useEffect(() => {
    void (async () => {
      log("location", {
        href: window.location.href,
        hostname: window.location.hostname,
      });

      log("env", {
        VITE_PI_SANDBOX: import.meta.env.VITE_PI_SANDBOX ?? null,
        VITE_TRUEGO_APP_MODE: import.meta.env.VITE_TRUEGO_APP_MODE ?? null,
        hasSupabaseUrl: Boolean(import.meta.env.VITE_SUPABASE_URL),
        hasSupabaseAnonKey: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
      });

      log("Pi before init", {
        available: isPiSdkAvailable(),
        hasWindowPi: typeof window.Pi !== "undefined",
      });

      const ready = await initPiSdk();

      log("Pi after init", {
        ready,
        available: isPiSdkAvailable(),
        hasWindowPi: typeof window.Pi !== "undefined",
      });
    })();
  }, []);

  async function testAuthenticate(): Promise<PiAuthResult | null> {
    try {
      log("authenticate start", { scopes: ["username", "payments"] });

      if (!window.Pi) {
        log("authenticate failed", "window.Pi is missing");
        return null;
      }

      const result = await window.Pi.authenticate(
        ["username", "payments"],
        (payment) => {
          log("authenticate onIncompletePaymentFound", summarizePayment(payment));
        }
      );

      setAuthResult(result);

      log("authenticate success", {
        uid: result.user?.uid,
        username: result.user?.username,
        hasAccessToken: Boolean(result.accessToken),
      });

      return result;
    } catch (error) {
      log("authenticate error", summarizeError(error));
      return null;
    }
  }

  async function testCreatePaymentCallback() {
    try {
      const trimmedRideId = rideId.trim();

      log("createPayment test start", {
        amount: DEBUG_AMOUNT_PI,
        rideId: trimmedRideId,
      });

      if (!trimmedRideId) {
        log("createPayment failed", "Ride ID is required for approve/complete debug");
        return;
      }

      if (!window.Pi) {
        log("createPayment failed", "window.Pi is missing");
        return;
      }

      const login = authResult ?? (await testAuthenticate());

      if (!login?.user?.uid) {
        log("createPayment failed", "No Pi UID available after authentication");
        return;
      }

      const paymentData = {
        amount: DEBUG_AMOUNT_PI,
        memo: `TrueGo debug payment ${Date.now()}`,
        metadata: {
          debug: true,
          source: "PiDebug",
          app: "TrueGo",
          rideId: trimmedRideId,
          createdAt: new Date().toISOString(),
        },
        uid: login.user.uid,
      };

      let approvalStarted = false;
      let completionStarted = false;

      log("createPayment call", paymentData);

      window.Pi.createPayment(paymentData, {
        onReadyForServerApproval: async (paymentId) => {
          log("createPayment onReadyForServerApproval", { paymentId });

          if (approvalStarted) {
            log("approve skipped", {
              paymentId,
              reason: "Approval already started for this debug payment",
            });
            return;
          }

          approvalStarted = true;

          const approveResult = await callEdgeFunctionRaw("pi-payment-approve", {
            rideId: trimmedRideId,
            paymentId,
            amountPi: DEBUG_AMOUNT_PI,
          });

          log("approve edge result", approveResult);
        },

        onReadyForServerCompletion: async (paymentId, txid) => {
          log("createPayment onReadyForServerCompletion", { paymentId, txid });

          if (completionStarted) {
            log("complete skipped", {
              paymentId,
              txid,
              reason: "Completion already started for this debug payment",
            });
            return;
          }

          completionStarted = true;

          const completeResult = await callEdgeFunctionRaw("pi-payment-complete", {
            rideId: trimmedRideId,
            paymentId,
            txid,
            amountPi: DEBUG_AMOUNT_PI,
          });

          log("complete edge result", completeResult);
        },

        onCancel: (paymentId) => {
          log("createPayment onCancel", { paymentId });
        },

        onError: (error, payment) => {
          log("createPayment onError", {
            error: summarizeError(error),
            payment: summarizePayment(payment),
          });
        },
      });
    } catch (error) {
      log("createPayment outer error", summarizeError(error));
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: "24px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>TrueGo Pi Debug</h1>
      <p>
        This page checks Pi SDK initialization, authentication, createPayment
        callbacks, and raw Edge Function approve/complete responses.
      </p>

      <label style={{ display: "block", marginBottom: 12, fontWeight: 700 }}>
        Debug ride ID
        <input
          value={rideId}
          onChange={(event) => setRideId(event.target.value)}
          style={{
            display: "block",
            width: "100%",
            marginTop: 6,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #cbd5e1",
          }}
        />
      </label>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void testAuthenticate()}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: 0,
            background: "#111827",
            color: "white",
            fontWeight: 700,
          }}
        >
          Test Pi authenticate
        </button>

        <button
          type="button"
          onClick={() => void testCreatePaymentCallback()}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: 0,
            background: "#7c3aed",
            color: "white",
            fontWeight: 700,
          }}
        >
          Test Pi createPayment + approve/complete
        </button>
      </div>

      <pre
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 12,
          background: "#0f172a",
          color: "#e5e7eb",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {logs.join("\n")}
      </pre>
    </div>
  );
}
