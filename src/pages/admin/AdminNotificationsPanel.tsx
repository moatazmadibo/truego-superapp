import { useState, type CSSProperties } from "react";
import { requireAdminSessionToken } from "../../components/admin/adminSession";
import { supabase } from "../../lib/supabase";

type TargetApp = "rider" | "driver" | "all";
type TargetMode = "broadcast" | "demo_driver_id" | "pi_uid" | "pi_username";

function panelStyle(): CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  };
}

function gridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginTop: 12,
  };
}

function inputStyle(): CSSProperties {
  return {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    font: "inherit",
    boxSizing: "border-box",
  };
}

function buttonStyle(disabled = false): CSSProperties {
  return {
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "10px 14px",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

export default function AdminNotificationsPanel() {
  const [targetApp, setTargetApp] = useState<TargetApp>("driver");
  const [targetMode, setTargetMode] = useState<TargetMode>("broadcast");
  const [demoDriverId, setDemoDriverId] = useState("");
  const [piUid, setPiUid] = useState("");
  const [piUsername, setPiUsername] = useState("");
  const [title, setTitle] = useState("Complete your TrueGo setup");
  const [body, setBody] = useState(
    "Please open TrueGo and complete the required steps so you can use the app smoothly."
  );
  const [actionUrl, setActionUrl] = useState("#driver-verification");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function applyRiderTemplate() {
    setTargetApp("rider");
    setTargetMode("broadcast");
    setTitle("Request your next ride with TrueGo");
    setBody(
      "Open TrueGo Rider, compare driver offers, track your trip, and pay with Pi after completion."
    );
    setActionUrl("#request-ride");
  }

  function applyDriverVerificationTemplate() {
    setTargetApp("driver");
    setTargetMode("broadcast");
    setTitle("Complete your driver verification");
    setBody(
      "Please complete your contact profile, vehicle details, documents, and payout wallet address to become ready for approval."
    );
    setActionUrl("#driver-verification");
  }

  function applyDriverWalletTemplate() {
    setTargetApp("driver");
    setTargetMode("broadcast");
    setTitle("Add your payout wallet");
    setBody(
      "Add your Pi Wallet public address from Pi Wallet → Receive so Admin can send your driver payout manually."
    );
    setActionUrl("#driver-payout-wallet");
  }

  async function sendNotification() {
    setSending(true);
    setMessage("");
    setError("");

    try {
      const broadcast = targetMode === "broadcast";

      const { data, error: sendError } = await supabase.rpc(
        "admin_send_user_notification",
        {
          p_admin_session_token: requireAdminSessionToken(),
          p_target_app: targetApp,
          p_target_pi_uid: targetMode === "pi_uid" ? piUid.trim() : null,
          p_target_pi_username:
            targetMode === "pi_username" ? piUsername.trim().replace(/^@/, "") : null,
          p_target_demo_driver_id:
            targetMode === "demo_driver_id" ? demoDriverId.trim() : null,
          p_title: title.trim(),
          p_body: body.trim(),
          p_notification_type: "admin_message",
          p_action_url: actionUrl.trim() || null,
          p_broadcast: broadcast,
        }
      );

      if (sendError) throw sendError;

      const result = data as { sent_count?: number } | null;
      setMessage(`Notification sent. Recipients: ${result?.sent_count ?? 0}`);
    } catch (sendError) {
      setError(getErrorMessage(sendError, "Failed to send notification."));
    } finally {
      setSending(false);
    }
  }

  return (
    <section style={panelStyle()}>
      <h2 style={{ marginTop: 0 }}>Notifications</h2>
      <p style={{ color: "#64748b", lineHeight: 1.6 }}>
        Send in-app notifications to Rider and Driver users. These notifications appear inside the app using the 🔔 button.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" style={buttonStyle()} onClick={applyRiderTemplate}>
          Rider reminder
        </button>
        <button type="button" style={buttonStyle()} onClick={applyDriverVerificationTemplate}>
          Driver verification
        </button>
        <button type="button" style={buttonStyle()} onClick={applyDriverWalletTemplate}>
          Driver wallet
        </button>
      </div>

      {message ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#047857" }}>
          {message}
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
          {error}
        </div>
      ) : null}

      <div style={gridStyle()}>
        <label>
          <strong>Target app</strong>
          <select value={targetApp} onChange={(event) => setTargetApp(event.target.value as TargetApp)} style={{ ...inputStyle(), marginTop: 6 }}>
            <option value="rider">Rider</option>
            <option value="driver">Driver</option>
            <option value="all">All</option>
          </select>
        </label>

        <label>
          <strong>Target mode</strong>
          <select value={targetMode} onChange={(event) => setTargetMode(event.target.value as TargetMode)} style={{ ...inputStyle(), marginTop: 6 }}>
            <option value="broadcast">All users who opened the app</option>
            <option value="demo_driver_id">Specific driver ID</option>
            <option value="pi_uid">Specific Pi UID</option>
            <option value="pi_username">Specific Pi username</option>
          </select>
        </label>
      </div>

      {targetMode === "demo_driver_id" ? (
        <label style={{ display: "block", marginTop: 12 }}>
          <strong>Driver ID</strong>
          <input value={demoDriverId} onChange={(event) => setDemoDriverId(event.target.value)} style={{ ...inputStyle(), marginTop: 6 }} />
        </label>
      ) : null}

      {targetMode === "pi_uid" ? (
        <label style={{ display: "block", marginTop: 12 }}>
          <strong>Pi UID</strong>
          <input value={piUid} onChange={(event) => setPiUid(event.target.value)} style={{ ...inputStyle(), marginTop: 6 }} />
        </label>
      ) : null}

      {targetMode === "pi_username" ? (
        <label style={{ display: "block", marginTop: 12 }}>
          <strong>Pi username</strong>
          <input value={piUsername} onChange={(event) => setPiUsername(event.target.value)} placeholder="moatazmadibo" style={{ ...inputStyle(), marginTop: 6 }} />
        </label>
      ) : null}

      <label style={{ display: "block", marginTop: 12 }}>
        <strong>Title</strong>
        <input value={title} onChange={(event) => setTitle(event.target.value)} style={{ ...inputStyle(), marginTop: 6 }} />
      </label>

      <label style={{ display: "block", marginTop: 12 }}>
        <strong>Body</strong>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} style={{ ...inputStyle(), marginTop: 6 }} />
      </label>

      <label style={{ display: "block", marginTop: 12 }}>
        <strong>Action URL / section</strong>
        <input value={actionUrl} onChange={(event) => setActionUrl(event.target.value)} placeholder="#driver-verification" style={{ ...inputStyle(), marginTop: 6 }} />
      </label>

      <div style={{ marginTop: 10, color: "#64748b", lineHeight: 1.6 }}>
        Examples: #request-ride, #rider-history, #rider-safety, #driver-verification, #driver-payout-wallet, #driver-history
      </div>

      <button type="button" disabled={sending} onClick={() => void sendNotification()} style={{ ...buttonStyle(sending), marginTop: 14 }}>
        {sending ? "Sending..." : "Send notification"}
      </button>
    </section>
  );
}
