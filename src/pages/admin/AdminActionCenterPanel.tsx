import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { requireAdminSessionToken } from "../../components/admin/adminSession";
import { formatPiAmount } from "../../lib/piPricing";
import { supabase } from "../../lib/supabase";

type ActionRow = Record<string, unknown>;

type ActionCenterData = {
  generated_at?: string;
  summary?: Record<string, number>;
  driver_reviews?: ActionRow[];
  ride_exceptions?: ActionRow[];
  payment_exceptions?: ActionRow[];
  payout_actions?: ActionRow[];
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

function badgeStyle(background: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    minHeight: 28,
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

function statusColor(value: unknown) {
  const status = String(value ?? "");
  if (["approved", "completed", "paid", "processing"].includes(status)) return "#16a34a";
  if (["submitted", "pending", "needs_more_info", "offers_expired"].includes(status)) return "#f59e0b";
  if (["failed", "cancelled", "rejected", "no_driver_available"].includes(status)) return "#dc2626";
  return "#64748b";
}

function ActionList({
  title,
  rows,
  emptyText,
  renderRow,
}: {
  title: string;
  rows?: ActionRow[];
  emptyText: string;
  renderRow: (row: ActionRow) => ReactNode;
}) {
  return (
    <div style={cardStyle()}>
      <h3 style={{ marginTop: 0, marginBottom: 10 }}>{title}</h3>

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

export default function AdminActionCenterPanel() {
  const [data, setData] = useState<ActionCenterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadActionCenter() {
    setLoading(true);
    setError("");

    try {
      const { data: actionData, error: actionError } = await supabase.rpc(
        "admin_get_action_center",
        {
          p_admin_session_token: requireAdminSessionToken(),
        }
      );

      if (actionError) throw actionError;

      setData((actionData ?? {}) as ActionCenterData);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load action center.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadActionCenter();
  }, []);

  const summary = data?.summary ?? {};
  const totalActions =
    dbNumber(summary.driver_reviews) +
    dbNumber(summary.ride_exceptions) +
    dbNumber(summary.payment_exceptions) +
    dbNumber(summary.payout_actions);

  return (
    <div style={sectionStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Action Center</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.6 }}>
            Protected operational queue for reviews, exceptions, payments, and payouts.
          </p>
        </div>

        <button type="button" onClick={() => void loadActionCenter()} disabled={loading} style={buttonStyle(loading)}>
          {loading ? "Loading..." : "Refresh action center"}
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
        <div style={itemStyle()}><strong>Total action items</strong><div>{totalActions}</div></div>
        <div style={itemStyle()}><strong>Driver reviews</strong><div>{dbNumber(summary.driver_reviews)}</div></div>
        <div style={itemStyle()}><strong>Ride exceptions</strong><div>{dbNumber(summary.ride_exceptions)}</div></div>
        <div style={itemStyle()}><strong>Payment exceptions</strong><div>{dbNumber(summary.payment_exceptions)}</div></div>
        <div style={itemStyle()}><strong>Payout actions</strong><div>{dbNumber(summary.payout_actions)}</div></div>
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
        <ActionList
          title="Driver reviews"
          rows={data?.driver_reviews}
          emptyText="No pending driver review actions."
          renderRow={(row) => (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong>{textValue(row.driver_name, "Unknown driver")}</strong>
                <span style={badgeStyle(statusColor(row.verification_status))}>
                  {textValue(row.verification_status)}
                </span>
              </div>
              <div style={monoStyle()}>Driver ID: {textValue(row.demo_driver_id)}</div>
              <div>Pi: {row.pi_username ? `@${row.pi_username}` : "No Pi username"}</div>
              <div>Email verified: {row.email_verified ? "Yes" : "No"}</div>
              <div>Updated: {formatDate(row.updated_at)}</div>
            </>
          )}
        />

        <ActionList
          title="Ride exceptions"
          rows={data?.ride_exceptions}
          emptyText="No ride exception actions."
          renderRow={(row) => (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong>{textValue(row.driver_name, "No driver")}</strong>
                <span style={badgeStyle(statusColor(row.status))}>{textValue(row.status)}</span>
              </div>
              <div style={monoStyle()}>Ride ID: {textValue(row.id)}</div>
              <div>{textValue(row.pickup_text)} → {textValue(row.destination_text)}</div>
              <div>Amount: {formatPiAmount(dbNumber(row.amount_pi))}</div>
              <div>Created: {formatDate(row.created_at)}</div>
            </>
          )}
        />

        <ActionList
          title="Payment exceptions"
          rows={data?.payment_exceptions}
          emptyText="No payment exception actions."
          renderRow={(row) => (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong>{textValue(row.driver_name, "Unknown driver")}</strong>
                <span style={badgeStyle(statusColor(row.payment_status))}>
                  {textValue(row.payment_status)}
                </span>
              </div>
              <div style={monoStyle()}>Ride ID: {textValue(row.id)}</div>
              <div>Ride status: {textValue(row.status)}</div>
              <div>Amount: {formatPiAmount(dbNumber(row.amount_pi))}</div>
              <div style={monoStyle()}>Payment ID: {textValue(row.payment_id)}</div>
            </>
          )}
        />

        <ActionList
          title="Payout actions"
          rows={data?.payout_actions}
          emptyText="No payout action items."
          renderRow={(row) => (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong>{textValue(row.driver_name, "Unknown driver")}</strong>
                <span style={badgeStyle(statusColor(row.payout_status))}>
                  {textValue(row.payout_status)}
                </span>
              </div>
              <div>Driver payout: {formatPiAmount(dbNumber(row.driver_payout_pi))}</div>
              <div>Pi: {row.driver_pi_username ? `@${row.driver_pi_username}` : "No Pi username"}</div>
              <div style={monoStyle()}>Payout ID: {textValue(row.id)}</div>
              {row.payout_error ? <div style={{ color: "#b91c1c" }}>Error: {textValue(row.payout_error)}</div> : null}
            </>
          )}
        />
      </div>
    </div>
  );
}
