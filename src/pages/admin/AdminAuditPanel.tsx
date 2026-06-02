import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { requireAdminSessionToken } from "../../components/admin/adminSession";

type AuditLogRow = {
  id: string;
  event_time: string;
  source: string;
  actor: string | null;
  action: "INSERT" | "UPDATE" | "DELETE" | string;
  table_name: string;
  record_id: string | null;
  summary: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

function sectionStyle(): CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  };
}

function gridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
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

function buttonStyle(disabled = false): CSSProperties {
  return {
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "10px 14px",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

function badgeStyle(action: string): CSSProperties {
  const background =
    action === "INSERT" ? "#16a34a" : action === "UPDATE" ? "#2563eb" : "#dc2626";

  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    background,
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 12,
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

function shortJson(value: Record<string, unknown> | null) {
  if (!value) return "N/A";

  const keys = Object.keys(value).slice(0, 6);
  return keys.map((key) => `${key}: ${String(value[key] ?? "")}`).join(" · ");
}

export default function AdminAuditPanel() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [tableName, setTableName] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAuditLogs() {
    setLoading(true);
    setError("");

    try {
      const { data, error: auditError } = await supabase.rpc("admin_get_admin_audit_logs", {
        p_admin_session_token: requireAdminSessionToken(),
        p_limit: 150,
        p_table_name: tableName || null,
        p_from_date: fromDate || null,
        p_to_date: toDate || null,
      });

      if (auditError) throw auditError;

      setRows((data ?? []) as unknown as AuditLogRow[]);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load audit log.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAuditLogs();
  }, []);

  const tableOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.table_name))).sort();
  }, [rows]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      inserts: rows.filter((row) => row.action === "INSERT").length,
      updates: rows.filter((row) => row.action === "UPDATE").length,
      deletes: rows.filter((row) => row.action === "DELETE").length,
    };
  }, [rows]);

  return (
    <div style={sectionStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Audit Log</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.6 }}>
            Tracks sensitive admin, finance, payout, accounting, and driver verification changes.
          </p>
        </div>

        <button type="button" onClick={() => void loadAuditLogs()} disabled={loading} style={buttonStyle(loading)}>
          {loading ? "Loading..." : "Refresh audit log"}
        </button>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={gridStyle()}>
        <div style={itemStyle()}>
          <strong>Total events</strong>
          <div>{stats.total}</div>
        </div>
        <div style={itemStyle()}>
          <strong>Inserts</strong>
          <div>{stats.inserts}</div>
        </div>
        <div style={itemStyle()}>
          <strong>Updates</strong>
          <div>{stats.updates}</div>
        </div>
        <div style={itemStyle()}>
          <strong>Deletes</strong>
          <div>{stats.deletes}</div>
        </div>
      </div>

      <div style={gridStyle()}>
        <div style={itemStyle()}>
          <strong>Table</strong>
          <select
            value={tableName}
            onChange={(event) => setTableName(event.target.value)}
            style={{
              width: "100%",
              marginTop: 8,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          >
            <option value="">All tables</option>
            {tableOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div style={itemStyle()}>
          <strong>From date</strong>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            style={{
              width: "100%",
              marginTop: 8,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={itemStyle()}>
          <strong>To date</strong>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            style={{
              width: "100%",
              marginTop: 8,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={itemStyle()}>
          <strong>Apply filters</strong>
          <div style={{ marginTop: 8 }}>
            <button type="button" onClick={() => void loadAuditLogs()} disabled={loading} style={buttonStyle(loading)}>
              Load audit events
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        {rows.length === 0 ? (
          <p style={{ color: "#64748b" }}>
            No audit events yet. New finance, payout, driver verification, and accounting changes will appear here.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Time</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Action</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Table</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Record</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 8 }}>Summary</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                    {formatDate(row.event_time)}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                    <span style={badgeStyle(row.action)}>{row.action}</span>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                    {row.table_name}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                    <div style={monoStyle()}>{row.record_id ?? "N/A"}</div>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                    <strong>{row.summary ?? "No summary"}</strong>
                    <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
                      New: {shortJson(row.new_data)}
                    </div>
                    {row.old_data ? (
                      <div style={{ marginTop: 2, color: "#64748b", fontSize: 12 }}>
                        Old: {shortJson(row.old_data)}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
