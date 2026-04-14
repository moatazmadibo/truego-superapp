import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { listRecentRides, subscribeToLatestRides, type RideRow } from "../../services/rideApi";

type DashboardStats = {
  total: number;
  active: number;
  completed: number;
  noDriverAvailable: number;
  revenuePi: number;
};

function formatStatus(status: RideRow["status"]) {
  switch (status) {
    case "searching":
      return "Searching";
    case "offer_sent":
      return "Offer sent";
    case "driver_assigned":
      return "Driver assigned";
    case "driver_arriving":
      return "Driver arriving";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "no_driver_available":
      return "No driver available";
    default:
      return status;
  }
}

function formatPi(value: number) {
  return `${value.toFixed(2)} Pi`;
}

function pageStyle(): React.CSSProperties {
  return {
    maxWidth: 1100,
    margin: "32px auto",
    padding: 20,
  };
}

function sectionStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  };
}

function statsGridStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginTop: 16,
  };
}

function statCardStyle(): React.CSSProperties {
  return {
    padding: 16,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  };
}

function rideCardStyle(): React.CSSProperties {
  return {
    padding: 16,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    marginTop: 12,
  };
}

export default function AdminDashboard() {
  const [rides, setRides] = useState<RideRow[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    active: 0,
    completed: 0,
    noDriverAvailable: 0,
    revenuePi: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    try {
      setError(null);

      const [
        recentRides,
        totalResult,
        activeResult,
        completedResult,
        noDriverResult,
        revenueResult,
      ] = await Promise.all([
        listRecentRides(20),
        supabase.from("rides").select("id", { count: "exact", head: true }),
        supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .in("status", [
            "searching",
            "offer_sent",
            "driver_assigned",
            "driver_arriving",
            "in_progress",
          ]),
        supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed"),
        supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .eq("status", "no_driver_available"),
        supabase.from("rides").select("price_pi").eq("status", "completed"),
      ]);

      if (totalResult.error) throw totalResult.error;
      if (activeResult.error) throw activeResult.error;
      if (completedResult.error) throw completedResult.error;
      if (noDriverResult.error) throw noDriverResult.error;
      if (revenueResult.error) throw revenueResult.error;

      const revenuePi = (revenueResult.data ?? []).reduce((sum, row) => {
        return sum + Number(row.price_pi ?? 0);
      }, 0);

      setRides(recentRides);
      setStats({
        total: totalResult.count ?? 0,
        active: activeResult.count ?? 0,
        completed: completedResult.count ?? 0,
        noDriverAvailable: noDriverResult.count ?? 0,
        revenuePi,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load admin dashboard";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();

    const unsubscribe = subscribeToLatestRides(() => {
      void loadDashboard();
    });

    return unsubscribe;
  }, []);

  return (
    <div style={pageStyle()}>
      <h1 style={{ marginTop: 0, marginBottom: 0 }}>TrueGo Admin Dashboard</h1>
      <p style={{ color: "#6b7280", marginTop: 8 }}>
        Live overview of all rides plus the latest 20 rides.
      </p>

      <div style={statsGridStyle()}>
        <div style={statCardStyle()}>
          <div style={{ color: "#6b7280", fontSize: 14 }}>Total rides</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {stats.total}
          </div>
        </div>

        <div style={statCardStyle()}>
          <div style={{ color: "#6b7280", fontSize: 14 }}>Active rides</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {stats.active}
          </div>
        </div>

        <div style={statCardStyle()}>
          <div style={{ color: "#6b7280", fontSize: 14 }}>Completed rides</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {stats.completed}
          </div>
        </div>

        <div style={statCardStyle()}>
          <div style={{ color: "#6b7280", fontSize: 14 }}>No driver available</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {stats.noDriverAvailable}
          </div>
        </div>

        <div style={statCardStyle()}>
          <div style={{ color: "#6b7280", fontSize: 14 }}>Completed revenue</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {formatPi(stats.revenuePi)}
          </div>
        </div>
      </div>

      <div style={sectionStyle()}>
        <h2 style={{ marginTop: 0 }}>Recent rides</h2>

        {loading ? <p>Loading rides...</p> : null}

        {error ? (
          <div
            style={{
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

        {!loading && !error && rides.length === 0 ? <p>No rides found yet.</p> : null}

        {!loading && !error && rides.length > 0
          ? rides.map((ride) => (
              <div key={ride.id} style={rideCardStyle()}>
                <div><strong>Ride ID:</strong> {ride.id}</div>
                <div><strong>Status:</strong> {formatStatus(ride.status)}</div>
                <div><strong>Rider:</strong> {ride.rider_name ?? "Unknown rider"}</div>
                <div><strong>Driver:</strong> {ride.driver_name ?? "Not assigned"}</div>
                <div><strong>Pickup:</strong> {ride.pickup_text}</div>
                <div><strong>Destination:</strong> {ride.destination_text}</div>
                <div><strong>Distance:</strong> {ride.distance_km.toFixed(2)} km</div>
                <div><strong>Time:</strong> {ride.duration_min} min</div>
                <div><strong>Price:</strong> {formatPi(ride.price_pi)}</div>
              </div>
            ))
          : null}
      </div>
    </div>
  );
}
