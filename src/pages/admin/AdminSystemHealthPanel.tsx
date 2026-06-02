import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { requireAdminSessionToken } from "../../components/admin/adminSession";
import { formatPiAmount } from "../../lib/piPricing";

type HealthData = {
  session?: Record<string, unknown>;
  rides?: Record<string, number>;
  payments?: Record<string, number>;
  drivers?: Record<string, number>;
  driver_verification?: Record<string, number>;
  payouts?: Record<string, number>;
  accounting?: Record<string, number>;
  audit?: Record<string, number>;
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

function cardStyle(): CSSProperties {
  return {
    padding: 14,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
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

function dbNumber(value: unknown) {
  return Number(value ?? 0);
}

function formatKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function HealthGroup({
  title,
  data,
  piKeys = [],
}: {
  title: string;
  data?: Record<string, number>;
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
              <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900 }}>
                {piKeys.includes(key) ? formatPiAmount(dbNumber(value)) : dbNumber(value)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminSystemHealthPanel() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadHealth() {
    setLoading(true);
    setError("");

    try {
      const { data, error: healthError } = await supabase.rpc("admin_get_system_health", {
        p_admin_session_token: requireAdminSessionToken(),
      });

      if (healthError) throw healthError;

      setHealth((data ?? {}) as HealthData);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load system health.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  const readinessNotes = useMemo(() => {
    const notes: string[] = [];

    if (dbNumber(health?.drivers?.approved) === 0) {
      notes.push("No approved drivers yet.");
    }

    if (dbNumber(health?.payments?.completed) === 0) {
      notes.push("No completed payments found.");
    }

    if (dbNumber(health?.audit?.protected_actions) === 0) {
      notes.push("No protected admin actions recorded yet.");
    }

    if (notes.length === 0) {
      notes.push("Core admin readiness looks healthy for the current test dataset.");
    }

    return notes;
  }, [health]);

  return (
    <div style={sectionStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>System Health</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.6 }}>
            Protected operational snapshot for Admin readiness, payments, payouts, accounting, and audit activity.
          </p>
        </div>

        <button type="button" onClick={() => void loadHealth()} disabled={loading} style={buttonStyle(loading)}>
          {loading ? "Loading..." : "Refresh health"}
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

      <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "#ecfdf5", border: "1px solid #bbf7d0" }}>
        <strong>Readiness notes</strong>
        <ul style={{ marginBottom: 0 }}>
          {readinessNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
        <HealthGroup title="Rides" data={health?.rides} />
        <HealthGroup title="Payments" data={health?.payments} piKeys={["collected_pi"]} />
        <HealthGroup title="Drivers" data={health?.drivers} />
        <HealthGroup title="Driver Verification" data={health?.driver_verification} />
        <HealthGroup title="Payouts" data={health?.payouts} piKeys={["payable_pi", "paid_pi"]} />
        <HealthGroup title="Accounting" data={health?.accounting} />
        <HealthGroup title="Audit" data={health?.audit} />
      </div>
    </div>
  );
}
