import { useState, type CSSProperties } from "react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import {
  requestDriverEmailOtp,
  updatePiDriverContactProfile,
  verifyDriverEmailOtp,
  type DemoDriverRow,
} from "../../services/rideApi";

function sectionStyle(): CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  };
}

function inputStyle(): CSSProperties {
  return {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
    font: "inherit",
    marginTop: 6,
  };
}

function labelStyle(): CSSProperties {
  return {
    display: "block",
    marginTop: 12,
    fontWeight: 800,
    color: "#334155",
    fontSize: 13,
  };
}

function buttonStyle(disabled = false): CSSProperties {
  return {
    border: 0,
    borderRadius: 12,
    padding: "12px 16px",
    color: "#ffffff",
    background: "#0f766e",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

function secondaryButtonStyle(disabled = false): CSSProperties {
  return {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "12px 16px",
    color: "#475569",
    background: "#f1f5f9",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.75 : 1,
  };
}

function messageStyle(type: "success" | "error" | "info" | "warning"): CSSProperties {
  const palette = {
    success: {
      background: "#ecfdf5",
      border: "#bbf7d0",
      color: "#047857",
    },
    error: {
      background: "#fef2f2",
      border: "#fecaca",
      color: "#b91c1c",
    },
    info: {
      background: "#eff6ff",
      border: "#bfdbfe",
      color: "#1d4ed8",
    },
    warning: {
      background: "#fff7ed",
      border: "#fed7aa",
      color: "#9a3412",
    },
  }[type];

  return {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    background: palette.background,
    border: `1px solid ${palette.border}`,
    color: palette.color,
    lineHeight: 1.6,
  };
}

function statusPillStyle(kind: "ok" | "pending" | "blocked"): CSSProperties {
  const palette = {
    ok: {
      background: "#dcfce7",
      color: "#166534",
      border: "#bbf7d0",
    },
    pending: {
      background: "#f1f5f9",
      color: "#475569",
      border: "#cbd5e1",
    },
    blocked: {
      background: "#fef2f2",
      color: "#991b1b",
      border: "#fecaca",
    },
  }[kind];

  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
    background: palette.background,
    color: palette.color,
    border: `1px solid ${palette.border}`,
  };
}

function fieldGridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
    marginTop: 12,
  };
}

function formatStatus(value?: string | null) {
  if (!value) return "pending";
  return value.replace(/_/g, " ");
}

function formatVerifiedAt(value?: string | null) {
  if (!value) return "Not verified yet";
  return new Date(value).toLocaleString();
}

function normalizePhone(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? `+${digits}` : "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export default function DriverContactProfileCard({ driver }: { driver: DemoDriverRow }) {
  const [localDriver, setLocalDriver] = useState(driver);
  const [email, setEmail] = useState(driver.email ?? "");
  const [phoneInput, setPhoneInput] = useState((driver.phone ?? "").replace(/^\+/, ""));
  const [emailOtp, setEmailOtp] = useState("");
  const [saving, setSaving] = useState(false);
  const [emailOtpLoading, setEmailOtpLoading] = useState(false);
  const [emailOtpRequestedAt, setEmailOtpRequestedAt] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const accountApproved = localDriver.account_status === "approved";
  const emailVerified = Boolean(localDriver.email_verified_at);
  const phoneVerified = Boolean(localDriver.phone_verified_at);

  async function saveContactProfile(options?: { silent?: boolean }) {
    const updatedDriver = await updatePiDriverContactProfile({
      driverId: localDriver.id,
      email: normalizeEmail(email),
      phone: normalizePhone(phoneInput),
    });

    setLocalDriver(updatedDriver);
    setEmail(updatedDriver.email ?? "");
    setPhoneInput((updatedDriver.phone ?? "").replace(/^\+/, ""));

    if (!options?.silent) {
      setMessage("Contact profile saved successfully. Verification status: pending.");
    }

    return updatedDriver;
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await saveContactProfile();
    } catch (saveError) {
      const saveMessage =
        saveError instanceof Error ? saveError.message : "Failed to save contact profile.";
      setError(saveMessage);
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestEmailOtp() {
    setEmailOtpLoading(true);
    setMessage("");
    setError("");

    try {
      const cleanEmail = normalizeEmail(email);

      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error("Enter a valid email address first.");
      }

      const updatedDriver = await saveContactProfile({ silent: true });

      await requestDriverEmailOtp({
        driverId: updatedDriver.id,
        email: cleanEmail,
        piUid: updatedDriver.pi_uid ?? null,
      });

      setEmailOtp("");
      setEmailOtpRequestedAt(new Date().toLocaleString());
      setMessage("Email OTP sent. Check your inbox and enter the 6-digit code.");
    } catch (otpError) {
      const otpMessage =
        otpError instanceof Error ? otpError.message : "Failed to request email OTP.";
      setError(otpMessage);
    } finally {
      setEmailOtpLoading(false);
    }
  }

  async function handleVerifyEmailOtp() {
    setEmailOtpLoading(true);
    setMessage("");
    setError("");

    try {
      const cleanEmail = normalizeEmail(email);
      const cleanOtp = emailOtp.replace(/[^\d]/g, "").slice(0, 6);

      if (cleanOtp.length !== 6) {
        throw new Error("Enter the 6-digit OTP code.");
      }

      const updatedDriver = await verifyDriverEmailOtp({
        driverId: localDriver.id,
        email: cleanEmail,
        otp: cleanOtp,
      });

      setLocalDriver(updatedDriver);
      setEmail(updatedDriver.email ?? "");
      setPhoneInput((updatedDriver.phone ?? "").replace(/^\+/, ""));
      setEmailOtp("");
      setMessage("Email verified successfully.");
    } catch (verifyError) {
      const verifyMessage =
        verifyError instanceof Error ? verifyError.message : "Failed to verify email OTP.";
      setError(verifyMessage);
    } finally {
      setEmailOtpLoading(false);
    }
  }

  return (
    <div style={sectionStyle()}>
      <h2 style={{ marginTop: 0 }}>Driver contact & onboarding</h2>

      <p style={{ marginTop: 6, color: "#475569", lineHeight: 1.6 }}>
        Keep your Pi account, phone, and email ready for admin approval and rider-driver communication.
      </p>

      <div style={fieldGridStyle()}>
        <div style={messageStyle("info")}>
          <strong>Pi account</strong>
          <br />
          {localDriver.pi_username ? `@${localDriver.pi_username}` : "Pi username not available"}
          <br />
          <span style={{ fontSize: 12 }}>
            UID: {localDriver.pi_uid ? localDriver.pi_uid : "Not linked"}
          </span>
        </div>

        <div style={messageStyle(accountApproved ? "success" : "warning")}>
          <strong>Go Online readiness</strong>
          <br />
          {accountApproved ? "Approved: driver can go online." : "Blocked until admin approval."}
        </div>
      </div>

      <div style={fieldGridStyle()}>
        <div>
          <strong>Account status</strong>
          <br />
          <span style={statusPillStyle(accountApproved ? "ok" : "blocked")}>
            {formatStatus(localDriver.account_status)}
          </span>
        </div>

        <div>
          <strong>Onboarding status</strong>
          <br />
          <span style={statusPillStyle(localDriver.onboarding_status === "approved" ? "ok" : "pending")}>
            {formatStatus(localDriver.onboarding_status)}
          </span>
        </div>
      </div>

      <label style={labelStyle()} htmlFor="driver-email">
        Email
      </label>
      <input
        id="driver-email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="driver@example.com"
        style={inputStyle()}
      />

      <div style={{ marginTop: 8 }}>
        <span style={statusPillStyle(emailVerified ? "ok" : "pending")}>
          Email: {emailVerified ? "Verified" : "Not verified"}
        </span>
        <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
          {formatVerifiedAt(localDriver.email_verified_at)}
        </div>
      </div>

      {!emailVerified ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                void handleRequestEmailOtp();
              }}
              disabled={emailOtpLoading || saving}
              style={secondaryButtonStyle(emailOtpLoading || saving)}
            >
              {emailOtpLoading ? "Please wait..." : "Request Email OTP"}
            </button>
          </div>

          {emailOtpRequestedAt ? (
            <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
              Last request: {emailOtpRequestedAt}
            </div>
          ) : null}

          <label style={labelStyle()} htmlFor="driver-email-otp">
            Email OTP code
          </label>
          <input
            id="driver-email-otp"
            value={emailOtp}
            onChange={(event) =>
              setEmailOtp(event.target.value.replace(/[^\d]/g, "").slice(0, 6))
            }
            placeholder="6-digit code"
            inputMode="numeric"
            maxLength={6}
            style={inputStyle()}
          />

          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={() => {
                void handleVerifyEmailOtp();
              }}
              disabled={emailOtpLoading || emailOtp.length !== 6}
              style={buttonStyle(emailOtpLoading || emailOtp.length !== 6)}
            >
              Verify Email
            </button>
          </div>
        </div>
      ) : null}

      <label style={labelStyle()} htmlFor="driver-phone">
        Phone
      </label>
      <PhoneInput
        country="sd"
        value={phoneInput}
        onChange={(value) => setPhoneInput(value)}
        enableSearch
        searchPlaceholder="Search country"
        inputProps={{
          id: "driver-phone",
          name: "driver-phone",
          required: false,
        }}
        inputStyle={{
          width: "100%",
          height: 44,
          borderRadius: 10,
          border: "1px solid #cbd5e1",
          font: "inherit",
        }}
        buttonStyle={{
          borderTopLeftRadius: 10,
          borderBottomLeftRadius: 10,
          border: "1px solid #cbd5e1",
        }}
        dropdownStyle={{
          textAlign: "left",
        }}
      />

      <div style={{ marginTop: 8 }}>
        <span style={statusPillStyle(phoneVerified ? "ok" : "pending")}>
          Phone: {phoneVerified ? "Verified" : "Not verified"}
        </span>
        <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
          {formatVerifiedAt(localDriver.phone_verified_at)}
        </div>
      </div>

      <div style={messageStyle("warning")}>
        <strong>Phone verification</strong>
        <br />
        Pending
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginTop: 14,
        }}
      >
        <button type="button" onClick={handleSave} disabled={saving} style={buttonStyle(saving)}>
          {saving ? "Saving..." : "Save contact profile"}
        </button>

        <button type="button" disabled style={secondaryButtonStyle(true)}>
          Phone OTP: pending
        </button>
      </div>

      {message ? <div style={messageStyle("success")}>{message}</div> : null}
      {error ? <div style={messageStyle("error")}>{error}</div> : null}
    </div>
  );
}
