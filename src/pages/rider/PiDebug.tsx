import { useEffect, useState } from "react";
import { initPiSdk, isPiSdkAvailable } from "../../lib/pi";

export default function PiDebug() {
  const [logs, setLogs] = useState<string[]>([]);

  function log(message: string, data?: unknown) {
    const line = data ? `${message}: ${JSON.stringify(data)}` : message;
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

  async function testAuthenticate() {
    try {
      log("authenticate start", { scopes: ["username", "payments"] });

      if (!window.Pi) {
        log("authenticate failed", "window.Pi is missing");
        return;
      }

      const result = await window.Pi.authenticate(
        ["username", "payments"],
        (payment) => {
          log("onIncompletePaymentFound", payment);
        }
      );

      log("authenticate success", {
        uid: result.user?.uid,
        username: result.user?.username,
        hasAccessToken: Boolean(result.accessToken),
      });
    } catch (error) {
      log("authenticate error", {
        message: error instanceof Error ? error.message : String(error),
        raw: String(error),
      });
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: "24px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>TrueGo Pi Debug</h1>
      <p>This page checks Pi SDK initialization and authentication only. It does not create payments.</p>

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
