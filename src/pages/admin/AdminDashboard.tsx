import { useEffect, useMemo, useState } from "react";
import {
  listRecentRides,
  subscribeToLatestRides,
  type RideRow,
} from "../../services/rideApi";

function formatStatus(status: RideRow["status"]) {
  switch (status) {
    case "searching":
      return "Searching";
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
    default:
      return status;
  }
}

function formatPi(value: number) {
  return `${value.toFixed(2)} Pi`;
}

export default function AdminDashboard() {
  const [rides, setRides] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadRides() {
    try {
      setError(null);
      const data = await listRecentRides(20);
      setRides(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load rides";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRides();

    const unsubscribe = subscribeToLatestRides(() => {
      void loadRides();
    });

    return unsubscribe;
  }, []);

  const stats = useMemo(() => {
    const total = rides.length;
    const active = rides.filter((ride) =>
      ["searching", "driver_assigned", "driver_arriving", "in_progress"].includes(
        ride.status
      )
    ).length;
    const completed = rides.filter((ride) => ride.status === "completed").length;
    const revenuePi = rides
      .filter((ride) => ride.status === "completed")
      .reduce((sum, ride) => sum + ride.price_pi, 0);

    return {
      total,
      active,
      completed,
      revenuePi,
    };
  }, [rides]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginBottom: 20 }}>TrueGo Admin Dashboard</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 16,
            background: "#fff",
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.7 }}>Total rides</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.total}</div>
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 16,
            background: "#fff",
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.7 }}>Active rides</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.active}</div>
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 16,
            background: "#fff",
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.7 }}>Completed rides</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{stats.completed}</div>
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 16,
            background: "#fff",
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.7 }}>Completed revenue</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {formatPi(stats.revenuePi)}
          </div>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 20,
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Recent rides</h2>

        {loading ? <p>Loading rides...</p> : null}
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

        {!loading && !error && rides.length === 0 ? (
          <p>No rides found yet.</p>
        ) : null}

        {!loading && !error && rides.length > 0 ? (
          <div style={{ display: "grid", gap: 12 }}>
            {rides.map((ride) => (
              <div
                key={ride.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 16,
                  background: "#f9fafb",
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <strong>Ride ID:</strong> {ride.id}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Status:</strong> {formatStatus(ride.status)}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Rider:</strong> {ride.rider_name ?? "Unknown rider"}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Driver:</strong> {ride.driver_name ?? "Not assigned"}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Pickup:</strong> {ride.pickup_text}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Destination:</strong> {ride.destination_text}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Distance:</strong> {ride.distance_km.toFixed(2)} km
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Time:</strong> {ride.duration_min} min
                </div>
                <div>
                  <strong>Price:</strong> {formatPi(ride.price_pi)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}