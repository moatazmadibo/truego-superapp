import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const ADMIN_SESSION_KEY = "truego_admin_access_session";
const ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

type StoredAdminSession = {
  grantedAt: number;
  expiresAt: string;
};

function loadStoredAdminSession() {
  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);

    if (!raw) {
      return null;
    }

    const session = JSON.parse(raw) as StoredAdminSession;
    const expiresAtMs = Date.parse(session.expiresAt);

    if (!session.grantedAt || !expiresAtMs) {
      window.localStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }

    if (Date.now() > expiresAtMs || Date.now() - session.grantedAt > ADMIN_SESSION_MAX_AGE_MS) {
      window.localStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }

    return session;
  } catch {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }
}

function saveAdminSession(expiresAt: string) {
  const session: StoredAdminSession = {
    grantedAt: Date.now(),
    expiresAt,
  };

  window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

function clearAdminSession() {
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
}

function pageStyle(): React.CSSProperties {
  return {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "#f8fafc",
    color: "#0f172a",
  };
}

function cardStyle(): React.CSSProperties {
  return {
    width: "min(440px, 100%)",
    padding: 22,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.10)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    marginTop: 8,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    font: "inherit",
    boxSizing: "border-box",
  };
}

function buttonStyle(disabled = false): React.CSSProperties {
  return {
    width: "100%",
    marginTop: 14,
    padding: "12px 14px",
    borderRadius: 999,
    border: "1px solid #111827",
    background: disabled ? "#64748b" : "#111827",
    color: "#ffffff",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function lockButtonStyle(): React.CSSProperties {
  return {
    position: "fixed",
    top: 14,
    right: 14,
    zIndex: 50,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid #334155",
    background: "#020617",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  };
}

export default function AdminAccessGate({ children }: { children: ReactNode }) {
  const [hasAccess, setHasAccess] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const session = loadStoredAdminSession();
    setHasAccess(Boolean(session));
    setLoading(false);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanCode = accessCode.trim();

    if (!cleanCode) {
      setError("Enter the admin access code.");
      return;
    }

    setChecking(true);
    setError("");

    try {
      const { data, error: verifyError } = await supabase.functions.invoke<{
        ok: boolean;
        expiresAt?: string;
        error?: string;
      }>("admin-access-verify", {
        body: {
          accessCode: cleanCode,
        },
      });

      if (verifyError) {
        throw verifyError;
      }

      if (!data?.ok || !data.expiresAt) {
        throw new Error(data?.error ?? "Invalid admin access code.");
      }

      saveAdminSession(data.expiresAt);
      setAccessCode("");
      setHasAccess(true);
    } catch (verifyError) {
      const message =
        verifyError instanceof Error ? verifyError.message : "Invalid admin access code.";
      setError(message);
    } finally {
      setChecking(false);
    }
  }

  function handleLockAdmin() {
    clearAdminSession();
    setHasAccess(false);
    setAccessCode("");
    setError("");
  }

  if (loading) {
    return (
      <div style={pageStyle()}>
        <div style={cardStyle()}>
          <strong>Loading admin access...</strong>
        </div>
      </div>
    );
  }

  if (hasAccess) {
    return (
      <>
        <button type="button" onClick={handleLockAdmin} style={lockButtonStyle()}>
          Lock admin
        </button>
        {children}
      </>
    );
  }

  return (
    <div style={pageStyle()}>
      <form onSubmit={handleSubmit} style={cardStyle()}>
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>TrueGo Admin Access</h1>
        <p style={{ marginTop: 0, color: "#64748b", lineHeight: 1.6 }}>
          Enter the admin access code to monitor rides, payments, driver verification,
          finance, reports, payouts, and audit logs.
        </p>

        <label htmlFor="truego-admin-access-code" style={{ fontWeight: 800 }}>
          Admin access code
        </label>
        <input
          id="truego-admin-access-code"
          type="password"
          value={accessCode}
          onChange={(event) => setAccessCode(event.target.value)}
          placeholder="Enter access code"
          autoComplete="current-password"
          style={inputStyle()}
        />

        {error ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
            }}
          >
            {error}
          </div>
        ) : null}

        <button type="submit" disabled={checking} style={buttonStyle(checking)}>
          {checking ? "Checking..." : "Unlock admin"}
        </button>

        <p style={{ marginBottom: 0, marginTop: 12, color: "#94a3b8", fontSize: 12 }}>
          Admin sessions are stored locally for up to 8 hours.
        </p>
      </form>
    </div>
  );
}
