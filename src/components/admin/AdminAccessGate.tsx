import { useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "truego_admin_access_granted";

function pageStyle(): React.CSSProperties {
  return {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background: "#f1f5f9",
  };
}

function cardStyle(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 460,
    padding: 24,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 18px 55px rgba(15, 23, 42, 0.12)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    font: "inherit",
    boxSizing: "border-box",
    marginTop: 8,
  };
}

function buttonStyle(background: string): React.CSSProperties {
  return {
    width: "100%",
    marginTop: 14,
    padding: "12px 14px",
    borderRadius: 12,
    border: 0,
    background,
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  };
}

export default function AdminAccessGate({ children }: { children: ReactNode }) {
  const configuredCode =
    (import.meta.env.VITE_TRUEGO_ADMIN_ACCESS_CODE as string | undefined)?.trim() ||
    "truego-admin-demo";

  const [isGranted, setIsGranted] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setIsGranted(window.localStorage.getItem(STORAGE_KEY) === "yes");
  }, []);

  function unlock() {
    setError("");

    if (code.trim() !== configuredCode) {
      setError("Invalid admin access code.");
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, "yes");
    setIsGranted(true);
  }

  function lock() {
    window.localStorage.removeItem(STORAGE_KEY);
    setIsGranted(false);
    setCode("");
  }

  if (isGranted) {
    return (
      <>
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            padding: "8px 12px",
            background: "#111827",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            fontSize: 13,
          }}
        >
          <strong>TrueGo Admin Platform</strong>
          <button
            type="button"
            onClick={lock}
            style={{
              border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: 999,
              background: "transparent",
              color: "#ffffff",
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Lock admin
          </button>
        </div>

        {children}
      </>
    );
  }

  return (
    <div style={pageStyle()}>
      <div style={cardStyle()}>
        <div
          style={{
            display: "inline-flex",
            borderRadius: 999,
            padding: "6px 10px",
            background: "#dcfce7",
            color: "#166534",
            fontWeight: 900,
            fontSize: 12,
          }}
        >
          Admin access
        </div>

        <h1 style={{ marginBottom: 8 }}>TrueGo Admin Platform</h1>

        <p style={{ marginTop: 0, color: "#64748b", lineHeight: 1.6 }}>
          This operations dashboard is separated from Pi user login. Enter the
          admin access code to monitor rides, payments, driver verification, and
          live ride movement.
        </p>

        <label style={{ display: "block", fontWeight: 900 }}>
          Admin access code
        </label>

        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              unlock();
            }
          }}
          type="password"
          placeholder="Enter admin code"
          style={inputStyle()}
        />

        <button type="button" onClick={unlock} style={buttonStyle("#16a34a")}>
          Open Admin Platform
        </button>

        {error ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontWeight: 800,
            }}
          >
            {error}
          </div>
        ) : null}

        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            color: "#475569",
            lineHeight: 1.6,
            fontSize: 13,
          }}
        >
          Demo note: for production, this should be replaced with server-side
          admin roles and Supabase RLS policies.
        </div>
      </div>
    </div>
  );
}
