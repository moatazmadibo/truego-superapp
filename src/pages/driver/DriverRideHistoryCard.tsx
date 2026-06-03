import { useEffect, useState, type CSSProperties } from "react";
import { formatPiAmount } from "../../lib/piPricing";
import { supabase } from "../../lib/supabase";

type DriverProfile = {
  id: string;
  display_name?: string | null;
  pi_username?: string | null;
};

type DriverHistoryRideRow = {
  id: string;
  status: string | null;
  payment_status: string | null;
  demo_driver_id: string | null;
  offered_demo_driver_id: string | null;
  driver_name: string | null;
  pickup_text: string | null;
  destination_text: string | null;
  price_pi: number | string | null;
  payment_amount_pi: number | string | null;
  created_at: string | null;
  completed_at: string | null;
};

function cardStyle(): CSSProperties {
  return {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  };
}

function itemStyle(): CSSProperties {
  return {
    padding: 12,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    lineHeight: 1.5,
  };
}

function badgeStyle(status?: string | null): CSSProperties {
  const value = status ?? "unknown";
  const background =
    value === "completed" || value === "paid"
      ? "#16a34a"
      : value === "failed" || value === "cancelled"
        ? "#dc2626"
        : "#2563eb";

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 26,
    borderRadius: 999,
    padding: "0 10px",
    background,
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
}

function buttonStyle(disabled = false): CSSProperties {
  return {
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "9px 13px",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
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

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "N/A";
}

export default function DriverRideHistoryCard({
  driver,
}: {
  driver: DriverProfile | null;
}) {
  const [rides, setRides] = useState<DriverHistoryRideRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadHistory() {
    if (!driver?.id) {
      setRides([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: historyError } = await supabase
        .from("rides")
        .select(
          "id,status,payment_status,demo_driver_id,offered_demo_driver_id,driver_name,pickup_text,destination_text,price_pi,payment_amount_pi,created_at,completed_at"
        )
        .or(`demo_driver_id.eq.${driver.id},offered_demo_driver_id.eq.${driver.id}`)
        .order("created_at", { ascending: false })
        .limit(12);

      if (historyError) throw historyError;

      setRides((data ?? []) as DriverHistoryRideRow[]);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load driver operations history."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, [driver?.id]);

  return (
    <section style={cardStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ marginTop: 0, marginBottom: 6 }}>Operations History</h3>
          <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
            Previous ride requests and completed trips for this driver profile.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadHistory()}
          disabled={loading || !driver?.id}
          style={buttonStyle(loading || !driver?.id)}
        >
          {loading ? "Loading..." : "Refresh history"}
        </button>
      </div>

      {error ? <div style={{ marginTop: 12, color: "#b91c1c" }}>{error}</div> : null}

      {rides.length === 0 && driver?.id && !loading ? (
        <div style={{ marginTop: 12, color: "#64748b" }}>
          No previous driver operations yet. Accepted, offered, and completed rides will appear here.
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {rides.map((ride) => (
          <div key={ride.id} style={itemStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <strong>
                {ride.pickup_text ?? "Pickup"} → {ride.destination_text ?? "Destination"}
              </strong>
              <span style={badgeStyle(ride.status)}>{ride.status ?? "unknown"}</span>
            </div>

            <div style={{ marginTop: 8 }}>
              Driver: <strong>{ride.driver_name ?? driver?.display_name ?? "Driver"}</strong>
            </div>
            <div>Fare: {formatPiAmount(dbNumber(ride.payment_amount_pi ?? ride.price_pi))}</div>
            <div>
              Payment: <span style={badgeStyle(ride.payment_status)}>{ride.payment_status ?? "unpaid"}</span>
            </div>
            <div>Created: {formatDate(ride.created_at)}</div>
            <div>Completed: {formatDate(ride.completed_at)}</div>
            <div style={monoStyle()}>Ride ID: {ride.id}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
