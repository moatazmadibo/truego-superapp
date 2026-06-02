import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { requireAdminSessionToken } from "../../components/admin/adminSession";
import { formatPiAmount } from "../../lib/piPricing";
import { supabase } from "../../lib/supabase";

type IntegrityRow = Record<string, unknown>;

type IntegrityData = {
  generated_at?: string;
  summary?: Record<string, number>;
  paid_without_txid?: IntegrityRow[];
  completed_not_paid?: IntegrityRow[];
  approved_drivers_missing_documents?: IntegrityRow[];
  payout_paid_without_accounting?: IntegrityRow[];
  payout_paid_without_reference?: IntegrityRow[];
  payout_missing_driver_pi_account?: IntegrityRow[];
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
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
    marginTop: 12,
  };
}

function cardStyle(): CSSProperties {
  return {
    padding: 14,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    lineHeight: 1.5,
  };
}

function itemStyle(): CSSProperties {
  return {
    padding: 12,
    borderRadius: 12,
    background: "#ffffff",
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

function badgeStyle(count: number): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    borderRadius: 999,
    padding: "0 10px",
    background: count > 0 ? "#dc2626" : "#16a34a",
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

function dbNumber(value: unknown) {
  return Number(value ?? 0);
}

function textValue(value: unknown, fallback = "N/A") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function formatDate(value: unknown) {
  return value ? new Date(String(value)).toLocaleString() : "N/A";
}

function IntegrityList({
  title,
  count,
  rows,
  emptyText,
  renderRow,
}: {
  title: string;
  count: number;
  rows?: IntegrityRow[];
  emptyText: string;
  renderRow: (row: IntegrityRow) => ReactNode;
}) {
  return (
    <div style={cardStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>{title}</h3>
        <span style={badgeStyle(count)}>{count > 0 ? `${count} issue(s)` : "OK"}</span>
      </div>

      {!rows || rows.length === 0 ? (
        <p style={{ color: "#64748b" }}>{emptyText}</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row, index) => (
            <div key={`${title}-${index}`} style={itemStyle()}>
              {renderRow(row)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminIntegrityPanel() {
  const [data, setData] = useState<IntegrityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadIntegrity() {
    setLoading(true);
    setError("");

    try {
      const { data: result, error: integrityError } = await supabase.rpc(
        "admin_get_data_integrity_checks",
        {
          p_admin_session_token: requireAdminSessionToken(),
        }
      );

      if (integrityError) throw integrityError;

      setData((result ?? {}) as IntegrityData);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load integrity checks.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadIntegrity();
  }, []);

  const summary = data?.summary ?? {};
  const totalIssues = Object.values(summary).reduce(
    (sum, value) => sum + dbNumber(value),
    0
  );

  return (
    <div style={sectionStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Data Integrity</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.6 }}>
            Protected checks for payment, driver, payout, and accounting consistency.
          </p>
        </div>

        <button type="button" onClick={() => void loadIntegrity()} disabled={loading} style={buttonStyle(loading)}>
          {loading ? "Checking..." : "Refresh integrity"}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
          {error}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 14,
          background: totalIssues > 0 ? "#fffbeb" : "#ecfdf5",
          border: `1px solid ${totalIssues > 0 ? "#f59e0b" : "#16a34a"}`,
        }}
      >
        <strong>{totalIssues > 0 ? "Integrity issues found" : "Integrity looks clean"}</strong>
        <div style={{ marginTop: 6 }}>
          Total issue count: <strong>{totalIssues}</strong>
        </div>
      </div>

      <div style={gridStyle()}>
        {Object.entries(summary).map(([key, value]) => (
          <div key={key} style={itemStyle()}>
            <strong>{key.replace(/_/g, " ")}</strong>
            <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>
              {dbNumber(value)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
        <IntegrityList
          title="Paid rides without TXID"
          count={dbNumber(summary.paid_without_txid)}
          rows={data?.paid_without_txid}
          emptyText="No completed paid rides missing TXID."
          renderRow={(row) => (
            <>
              <strong>{textValue(row.driver_name, "Unknown driver")}</strong>
              <div style={monoStyle()}>Ride ID: {textValue(row.id)}</div>
              <div>Amount: {formatPiAmount(dbNumber(row.amount_pi))}</div>
              <div style={monoStyle()}>Payment ID: {textValue(row.payment_id)}</div>
              <div>Paid at: {formatDate(row.payment_completed_at)}</div>
            </>
          )}
        />

        <IntegrityList
          title="Completed rides not paid"
          count={dbNumber(summary.completed_not_paid)}
          rows={data?.completed_not_paid}
          emptyText="No completed rides missing payment completion."
          renderRow={(row) => (
            <>
              <strong>{textValue(row.driver_name, "Unknown driver")}</strong>
              <div style={monoStyle()}>Ride ID: {textValue(row.id)}</div>
              <div>Payment status: {textValue(row.payment_status)}</div>
              <div>Amount: {formatPiAmount(dbNumber(row.amount_pi))}</div>
              <div>Completed at: {formatDate(row.completed_at)}</div>
            </>
          )}
        />

        <IntegrityList
          title="Approved drivers missing documents"
          count={dbNumber(summary.approved_drivers_missing_documents)}
          rows={data?.approved_drivers_missing_documents}
          emptyText="No approved drivers missing required approved documents."
          renderRow={(row) => (
            <>
              <strong>{textValue(row.display_name, "Unknown driver")}</strong>
              <div style={monoStyle()}>Driver ID: {textValue(row.id)}</div>
              <div>Pi: {row.pi_username ? `@${row.pi_username}` : "No Pi username"}</div>
              <div>Documents: {textValue(row.documents_count)} total / {textValue(row.approved_documents_count)} approved</div>
            </>
          )}
        />

        <IntegrityList
          title="Paid payouts without accounting"
          count={dbNumber(summary.payout_paid_without_accounting)}
          rows={data?.payout_paid_without_accounting}
          emptyText="No paid payouts missing accounting journal entry."
          renderRow={(row) => (
            <>
              <strong>{textValue(row.driver_name, "Unknown driver")}</strong>
              <div style={monoStyle()}>Payout ID: {textValue(row.id)}</div>
              <div>Amount: {formatPiAmount(dbNumber(row.driver_payout_pi))}</div>
              <div>Processed: {formatDate(row.processed_at)}</div>
            </>
          )}
        />

        <IntegrityList
          title="Paid payouts without reference"
          count={dbNumber(summary.payout_paid_without_reference)}
          rows={data?.payout_paid_without_reference}
          emptyText="No paid payouts missing TXID/reference."
          renderRow={(row) => (
            <>
              <strong>{textValue(row.driver_name, "Unknown driver")}</strong>
              <div style={monoStyle()}>Payout ID: {textValue(row.id)}</div>
              <div>Amount: {formatPiAmount(dbNumber(row.driver_payout_pi))}</div>
              <div>Processed: {formatDate(row.processed_at)}</div>
            </>
          )}
        />

        <IntegrityList
          title="Payouts missing driver Pi account"
          count={dbNumber(summary.payout_missing_driver_pi_account)}
          rows={data?.payout_missing_driver_pi_account}
          emptyText="No payout records missing driver Pi account."
          renderRow={(row) => (
            <>
              <strong>{textValue(row.driver_name, "Unknown driver")}</strong>
              <div style={monoStyle()}>Payout ID: {textValue(row.id)}</div>
              <div>Pi username: {textValue(row.driver_pi_username, "Missing")}</div>
              <div>Pi UID: {textValue(row.driver_pi_uid, "Missing")}</div>
            </>
          )}
        />
      </div>
    </div>
  );
}
