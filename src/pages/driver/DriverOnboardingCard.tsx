import { useState } from "react";
import {
  createContactVerificationRequest,
  updatePiDriverContactProfile,
  type DemoDriverRow,
} from "../../services/rideApi";

function sectionStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.07)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
    font: "inherit",
    marginTop: 6,
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    marginTop: 12,
    fontWeight: 800,
    color: "#334155",
    fontSize: 13,
  };
}

function buttonStyle(background: string, disabled = false): React.CSSProperties {
  return {
    border: 0,
    borderRadius: 12,
    padding: "11px 14px",
    color: "#ffffff",
    background,
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

function statusBadge(verified: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    borderRadius: 999,
    padding: "6px 10px",
    background: verified ? "#dcfce7" : "#fef3c7",
    color: verified ? "#166534" : "#92400e",
    fontWeight: 900,
    fontSize: 12,
  };
}

export default function DriverOnboardingCard({
  driver,
  onDriverUpdated,
}: {
  driver: DemoDriverRow;
  onDriverUpdated: (driver: DemoDriverRow) => void;
}) {
  const [email, setEmail] = useState(driver.email ?? "");
  const [phone, setPhone] = useState(driver.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const emailVerified = Boolean(driver.email_verified_at);
  const phoneVerified = Boolean(driver.phone_verified_at);

  async function saveContacts() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const updated = await updatePiDriverContactProfile({
        driverId: driver.id,
        email,
        phone,
      });
      onDriverUpdated(updated);
      setMessage("Contact profile saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save contact profile.");
    } finally {
      setSaving(false);
    }
  }

  async function prepareVerification(channel: "email" | "phone") {
    const target = channel === "email" ? email.trim() : phone.trim();

    if (!target) {
      setError(channel === "email" ? "Enter your email first." : "Enter your phone number first.");
      return;
    }

    setAction(channel);
    setError("");
    setMessage("");

    try {
      await createContactVerificationRequest({
        role: "driver",
        channel,
        target,
        piUid: driver.pi_uid ?? null,
        driverId: driver.id,
        provider: "pending_provider",
      });

      setMessage(
        channel === "email"
          ? "Email verification request prepared. Email OTP sending will be connected to an email provider."
          : "Phone verification request prepared. SMS or WhatsApp OTP sending will be connected to a communication provider."
      );
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Failed to prepare verification request."
      );
    } finally {
      setAction("");
    }
  }

  return (
    <div style={sectionStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Driver onboarding</h2>
          <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.6 }}>
            Your driver profile is linked to your Pi account. Complete contact details,
            verification, vehicle profile, and documents before live operation.
          </p>
        </div>

        <span style={statusBadge(driver.account_status === "approved")}>
          {driver.account_status === "approved" ? "Approved" : "Pending approval"}
        </span>
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <div style={{ padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <strong>Pi account</strong>
          <div style={{ marginTop: 6 }}>{driver.pi_username ? `@${driver.pi_username}` : driver.display_name}</div>
        </div>
        <div style={{ padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <strong>Email</strong>
          <div style={{ marginTop: 6 }}>
            <span style={statusBadge(emailVerified)}>{emailVerified ? "Verified" : "Not verified"}</span>
          </div>
        </div>
        <div style={{ padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <strong>Phone</strong>
          <div style={{ marginTop: 6 }}>
            <span style={statusBadge(phoneVerified)}>{phoneVerified ? "Verified" : "Not verified"}</span>
          </div>
        </div>
      </div>

      <label style={labelStyle()} htmlFor="driver-email">Email address</label>
      <input id="driver-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="driver@example.com" style={inputStyle()} />

      <label style={labelStyle()} htmlFor="driver-phone">Phone number</label>
      <input id="driver-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+249..." style={inputStyle()} />

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={saveContacts} disabled={saving} style={buttonStyle("#0f766e", saving)}>
          {saving ? "Saving..." : "Save contact profile"}
        </button>

        <button type="button" onClick={() => void prepareVerification("email")} disabled={action !== ""} style={buttonStyle("#2563eb", action !== "")}>
          {action === "email" ? "Preparing..." : "Prepare email OTP"}
        </button>

        <button type="button" onClick={() => void prepareVerification("phone")} disabled={action !== ""} style={buttonStyle("#7c3aed", action !== "")}>
          {action === "phone" ? "Preparing..." : "Prepare phone OTP"}
        </button>
      </div>

      <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569", lineHeight: 1.6 }}>
        Email OTP and phone OTP are prepared in the database. Actual delivery will be connected later to an email/SMS/WhatsApp provider.
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
    </div>
  );
}
