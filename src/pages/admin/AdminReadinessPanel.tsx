import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { requireAdminSessionToken } from "../../components/admin/adminSession";
import { formatPiAmount } from "../../lib/piPricing";
import { supabase } from "../../lib/supabase";

type ReadinessStatus = "ready" | "warning" | "manual" | "blocked";

type ReadinessSnapshot = {
  generated_at?: string;
  security?: Record<string, unknown>;
  operations?: Record<string, unknown>;
  payments?: Record<string, unknown>;
  drivers?: Record<string, unknown>;
  verification?: Record<string, unknown>;
  finance?: Record<string, unknown>;
  payouts?: Record<string, unknown>;
};

type CheckItem = {
  title: string;
  detail: string;
  status: ReadinessStatus;
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
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    lineHeight: 1.5,
  };
}

function metricStyle(): CSSProperties {
  return {
    padding: 10,
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

function statusColor(status: ReadinessStatus) {
  if (status === "ready") return "#16a34a";
  if (status === "warning") return "#f59e0b";
  if (status === "manual") return "#2563eb";
  return "#dc2626";
}

function checkCardStyle(status: ReadinessStatus): CSSProperties {
  return {
    padding: 14,
    borderRadius: 14,
    background:
      status === "ready"
        ? "#ecfdf5"
        : status === "warning"
          ? "#fffbeb"
          : status === "manual"
            ? "#eff6ff"
            : "#fef2f2",
    border: `1px solid ${statusColor(status)}`,
  };
}

function statusBadgeStyle(status: ReadinessStatus): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 84,
    minHeight: 28,
    borderRadius: 999,
    padding: "0 10px",
    background: statusColor(status),
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 12,
    textTransform: "uppercase",
  };
}

function dbNumber(value: unknown) {
  return Number(value ?? 0);
}

function formatKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function MetricGroup({
  title,
  data,
  piKeys = [],
}: {
  title: string;
  data?: Record<string, unknown>;
  piKeys?: string[];
}) {
  const entries = Object.entries(data ?? {});

  return (
    <div style={cardStyle()}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>{title}</h3>

      {entries.length === 0 ? (
        <p style={{ color: "#64748b" }}>No data.</p>
      ) : (
        <div style={gridStyle()}>
          {entries.map(([key, value]) => (
            <div key={key} style={metricStyle()}>
              <strong>{formatKey(key)}</strong>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900 }}>
                {piKeys.includes(key) ? formatPiAmount(dbNumber(value)) : String(value ?? 0)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminReadinessPanel() {
  const [snapshot, setSnapshot] = useState<ReadinessSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadReadiness() {
    setLoading(true);
    setError("");

    try {
      const { data, error: readinessError } = await supabase.rpc(
        "admin_get_production_readiness",
        {
          p_admin_session_token: requireAdminSessionToken(),
        }
      );

      if (readinessError) throw readinessError;

      setSnapshot((data ?? {}) as ReadinessSnapshot);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load production readiness.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReadiness();
  }, []);

  const checks = useMemo<CheckItem[]>(() => {
    const adminProtectedActions = dbNumber(snapshot?.security?.protected_admin_actions);
    const adminAccessEvents = dbNumber(snapshot?.security?.admin_access_events);
    const completedPayments = dbNumber(snapshot?.payments?.payments_completed);
    const approvedDrivers = dbNumber(snapshot?.drivers?.drivers_approved);
    const piLinkedDrivers = dbNumber(snapshot?.drivers?.drivers_pi_linked);
    const financeSettingsExists = Boolean(snapshot?.finance?.finance_settings_exists);
    const payoutSettingsExists = Boolean(snapshot?.finance?.payout_settings_exists);
    const auditEvents = dbNumber(snapshot?.security?.audit_events);
    const journalEntries = dbNumber(snapshot?.finance?.journal_entries);

    return [
      {
        title: "Admin security",
        detail:
          adminProtectedActions > 0
            ? `${adminProtectedActions} protected admin actions recorded.`
            : "Protected admin actions are not recorded yet.",
        status: adminProtectedActions > 0 ? "ready" : "warning",
      },
      {
        title: "Audit log",
        detail:
          auditEvents > 0
            ? `${auditEvents} audit events available.`
            : "No audit events recorded.",
        status: auditEvents > 0 ? "ready" : "blocked",
      },
      {
        title: "Pi payments",
        detail:
          completedPayments > 0
            ? `${completedPayments} completed payment(s) found.`
            : "No completed payment yet.",
        status: completedPayments > 0 ? "ready" : "warning",
      },
      {
        title: "Approved drivers",
        detail:
          approvedDrivers > 0
            ? `${approvedDrivers} approved driver(s).`
            : "No approved drivers yet.",
        status: approvedDrivers > 0 ? "ready" : "warning",
      },
      {
        title: "Driver Pi binding",
        detail:
          piLinkedDrivers > 0
            ? `${piLinkedDrivers} driver(s) linked to Pi identity.`
            : "No driver is linked to Pi identity yet.",
        status: piLinkedDrivers > 0 ? "ready" : "warning",
      },
      {
        title: "Finance settings",
        detail: financeSettingsExists
          ? "Finance settings exist."
          : "Finance settings are missing.",
        status: financeSettingsExists ? "ready" : "blocked",
      },
      {
        title: "Payout settings",
        detail: payoutSettingsExists
          ? "Payout commission settings exist."
          : "Payout settings are missing.",
        status: payoutSettingsExists ? "ready" : "blocked",
      },
      {
        title: "Accounting ledger",
        detail:
          journalEntries > 0
            ? `${journalEntries} journal entry record(s).`
            : "No journal entries yet.",
        status: journalEntries > 0 ? "ready" : "warning",
      },
      {
        title: "Frontend Supabase URL",
        detail: import.meta.env.VITE_SUPABASE_URL
          ? "Configured in frontend environment."
          : "Missing VITE_SUPABASE_URL.",
        status: import.meta.env.VITE_SUPABASE_URL ? "ready" : "blocked",
      },
      {
        title: "Frontend Supabase anon key",
        detail: import.meta.env.VITE_SUPABASE_ANON_KEY
          ? "Configured in frontend environment."
          : "Missing VITE_SUPABASE_ANON_KEY.",
        status: import.meta.env.VITE_SUPABASE_ANON_KEY ? "ready" : "blocked",
      },
      {
        title: "Admin access secret",
        detail:
          adminAccessEvents > 0
            ? `${adminAccessEvents} admin access event(s) confirmed. Supabase secret is working.`
            : "No admin access event recorded yet. Confirm TRUEGO_ADMIN_ACCESS_CODE in Supabase secrets.",
        status: adminAccessEvents > 0 ? "ready" : "manual",
      },
      {
        title: "Pi payment server secrets",
        detail:
          completedPayments > 0
            ? `${completedPayments} completed Pi payment(s) confirmed. Payment secrets are working.`
            : "No completed Pi payment in this readiness window. Confirm Pi API/payment secrets in Supabase.",
        status: completedPayments > 0 ? "ready" : "manual",
      },
    ];
  }, [snapshot]);

  const readyCount = checks.filter((check) => check.status === "ready").length;
  const blockedCount = checks.filter((check) => check.status === "blocked").length;
  const warningCount = checks.filter((check) => check.status === "warning").length;
  const manualCount = checks.filter((check) => check.status === "manual").length;

  return (
    <div style={sectionStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Production Readiness</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.6 }}>
            Protected readiness checklist for TrueGo Admin, payments, drivers, finance, payouts, and audit controls.
          </p>
        </div>

        <button type="button" onClick={() => void loadReadiness()} disabled={loading} style={buttonStyle(loading)}>
          {loading ? "Loading..." : "Refresh readiness"}
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
        <div style={metricStyle()}><strong>Ready</strong><div>{readyCount}</div></div>
        <div style={metricStyle()}><strong>Warnings</strong><div>{warningCount}</div></div>
        <div style={metricStyle()}><strong>Manual checks</strong><div>{manualCount}</div></div>
        <div style={metricStyle()}><strong>Blocked</strong><div>{blockedCount}</div></div>
      </div>

      <div style={gridStyle()}>
        {checks.map((check) => (
          <div key={check.title} style={checkCardStyle(check.status)}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <strong>{check.title}</strong>
              <span style={statusBadgeStyle(check.status)}>{check.status}</span>
            </div>
            <p style={{ marginBottom: 0, color: "#334155" }}>{check.detail}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
        <MetricGroup title="Security" data={snapshot?.security} />
        <MetricGroup title="Operations" data={snapshot?.operations} />
        <MetricGroup title="Payments" data={snapshot?.payments} piKeys={["collected_pi"]} />
        <MetricGroup title="Drivers" data={snapshot?.drivers} />
        <MetricGroup title="Verification" data={snapshot?.verification} />
        <MetricGroup title="Finance" data={snapshot?.finance} />
        <MetricGroup title="Payouts" data={snapshot?.payouts} />
      </div>
    </div>
  );
}
