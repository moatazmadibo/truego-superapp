import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { requireAdminSessionToken } from "../../components/admin/adminSession";
import { supabase } from "../../lib/supabase";

type AdminSessionRow = {
  id: string;
  actor: string;
  status: "active" | "revoked" | "expired" | string;
  expires_at: string;
  last_seen_at: string | null;
  created_at: string;
  is_current: boolean;
};

function sectionStyle(): CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  };
}

function gridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
    marginTop: 12,
  };
}

function itemStyle(): CSSProperties {
  return {
    padding: 12,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    lineHeight: 1.5,
  };
}

function cardStyle(): CSSProperties {
  return {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
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

function dangerButtonStyle(disabled = false): CSSProperties {
  return {
    ...buttonStyle(disabled),
    border: "1px solid #dc2626",
    color: "#dc2626",
  };
}

function badgeStyle(status: string): CSSProperties {
  const background =
    status === "active" ? "#16a34a" : status === "expired" ? "#f59e0b" : "#64748b";

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    borderRadius: 999,
    padding: "0 10px",
    background,
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
}

function monoStyle(): CSSProperties {
  return {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    color: "#334155",
    wordBreak: "break-all",
  };
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "N/A";
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

export default function AdminSessionsPanel() {
  const [rows, setRows] = useState<AdminSessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSessions() {
    setLoading(true);
    setError("");

    try {
      const { data, error: sessionsError } = await supabase.rpc(
        "admin_list_admin_sessions",
        {
          p_admin_session_token: requireAdminSessionToken(),
          p_limit: 120,
        }
      );

      if (sessionsError) throw sessionsError;

      setRows((data ?? []) as unknown as AdminSessionRow[]);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load admin sessions."));
    } finally {
      setLoading(false);
    }
  }

  async function revokeSession(sessionId: string) {
    setActionLoading(sessionId);
    setError("");
    setMessage("");

    try {
      const { error: revokeError } = await supabase.rpc(
        "admin_revoke_admin_session_by_id",
        {
          p_admin_session_token: requireAdminSessionToken(),
          p_session_id: sessionId,
        }
      );

      if (revokeError) throw revokeError;

      setMessage("Admin session revoked.");
      await loadSessions();
    } catch (revokeError) {
      setError(getErrorMessage(revokeError, "Failed to revoke admin session."));
    } finally {
      setActionLoading("");
    }
  }

  async function revokeOtherSessions() {
    setActionLoading("revoke-other");
    setError("");
    setMessage("");

    try {
      const { data, error: revokeError } = await supabase.rpc(
        "admin_revoke_other_admin_sessions",
        {
          p_admin_session_token: requireAdminSessionToken(),
        }
      );

      if (revokeError) throw revokeError;

      const result = data as { revoked_count?: number } | null;
      setMessage(`Other active admin sessions revoked: ${result?.revoked_count ?? 0}.`);
      await loadSessions();
    } catch (revokeError) {
      setError(getErrorMessage(revokeError, "Failed to revoke other sessions."));
    } finally {
      setActionLoading("");
    }
  }

  async function markExpiredSessions() {
    setActionLoading("mark-expired");
    setError("");
    setMessage("");

    try {
      const { data, error: expiredError } = await supabase.rpc(
        "admin_mark_expired_admin_sessions",
        {
          p_admin_session_token: requireAdminSessionToken(),
        }
      );

      if (expiredError) throw expiredError;

      const result = data as { expired_count?: number } | null;
      setMessage(`Expired admin sessions marked: ${result?.expired_count ?? 0}.`);
      await loadSessions();
    } catch (expiredError) {
      setError(getErrorMessage(expiredError, "Failed to mark expired sessions."));
    } finally {
      setActionLoading("");
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((row) => row.status === "active").length,
      revoked: rows.filter((row) => row.status === "revoked").length,
      expired: rows.filter((row) => row.status === "expired").length,
      current: rows.filter((row) => row.is_current).length,
    };
  }, [rows]);

  return (
    <div style={sectionStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Admin Sessions</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.6 }}>
            Manage active, expired, and revoked admin access sessions.
          </p>
        </div>

        <button type="button" onClick={() => void loadSessions()} disabled={loading} style={buttonStyle(loading)}>
          {loading ? "Loading..." : "Refresh sessions"}
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
        <div style={itemStyle()}><strong>Total</strong><div>{stats.total}</div></div>
        <div style={itemStyle()}><strong>Active</strong><div>{stats.active}</div></div>
        <div style={itemStyle()}><strong>Revoked</strong><div>{stats.revoked}</div></div>
        <div style={itemStyle()}><strong>Expired</strong><div>{stats.expired}</div></div>
        <div style={itemStyle()}><strong>Current</strong><div>{stats.current}</div></div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <button
          type="button"
          onClick={() => void markExpiredSessions()}
          disabled={actionLoading !== ""}
          style={buttonStyle(actionLoading !== "")}
        >
          {actionLoading === "mark-expired" ? "Marking..." : "Mark expired sessions"}
        </button>

        <button
          type="button"
          onClick={() => void revokeOtherSessions()}
          disabled={actionLoading !== ""}
          style={dangerButtonStyle(actionLoading !== "")}
        >
          {actionLoading === "revoke-other" ? "Revoking..." : "Revoke other active sessions"}
        </button>
      </div>

      <div style={cardStyle()}>
        <h3 style={{ marginTop: 0 }}>Latest admin sessions</h3>

        {rows.length === 0 ? (
          <p style={{ color: "#64748b" }}>No admin sessions found.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((row) => (
              <div key={row.id} style={itemStyle()}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <strong>{row.is_current ? "Current session" : row.actor}</strong>
                    <div style={monoStyle()}>{row.id}</div>
                  </div>

                  <span style={badgeStyle(row.status)}>{row.status}</span>
                </div>

                <div style={gridStyle()}>
                  <div style={itemStyle()}>
                    <strong>Created</strong>
                    <div>{formatDate(row.created_at)}</div>
                  </div>
                  <div style={itemStyle()}>
                    <strong>Last seen</strong>
                    <div>{formatDate(row.last_seen_at)}</div>
                  </div>
                  <div style={itemStyle()}>
                    <strong>Expires</strong>
                    <div>{formatDate(row.expires_at)}</div>
                  </div>
                </div>

                {!row.is_current && row.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => void revokeSession(row.id)}
                    disabled={actionLoading !== ""}
                    style={{ ...dangerButtonStyle(actionLoading !== ""), marginTop: 10 }}
                  >
                    {actionLoading === row.id ? "Revoking..." : "Revoke session"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
