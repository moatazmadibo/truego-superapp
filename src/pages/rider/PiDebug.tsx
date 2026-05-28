import { useEffect, useState } from "react";
import { initPiSdk, isPiSdkAvailable } from "../../lib/pi";
import type { PiAuthResult, PiPayment } from "../../types/pi-sdk";

const DEBUG_AMOUNT_PI = 0.00002062;

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

export default function PiDebug() {
  const [logs, setLogs] = useState<string[]>([]);
  const [authResult, setAuthResult] = useState<PiAuthResult | null>(null);

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
      log("createPayment test start", { amount: DEBUG_AMOUNT_PI });

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
          createdAt: new Date().toISOString(),
        },
        uid: login.user.uid,
      };

      log("createPayment call", paymentData);

      window.Pi.createPayment(paymentData, {
        onReadyForServerApproval: (paymentId) => {
          log("createPayment onReadyForServerApproval", { paymentId });
        },
        onReadyForServerCompletion: (paymentId, txid) => {
          log("createPayment onReadyForServerCompletion", { paymentId, txid });
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
    <div style={{ maxWidth: 820, margin: "24px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>TrueGo Pi Debug</h1>
      <p>
        This page checks Pi SDK initialization, authentication, and createPayment
        callbacks only. It does not update rides or Supabase.
      </p>

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
          Test Pi createPayment callback
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
