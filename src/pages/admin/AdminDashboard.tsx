import { useEffect, useMemo, useState } from "react";

import type { Ride } from "../../types/ride";
import RideTimeline from "../../components/RideTimeline";
import StatusBadge from "../../components/StatusBadge";
import { clearSelectedDriverId } from "../../services/demoSession";
import {
  clearDemoState,
  getDriverById,
  getRides,
  seedDrivers,
} from "../../services/mockRealtimeStore";

function containerStyle(): React.CSSProperties {
  return {
    maxWidth: 980,
    margin: "40px auto",
    background: "#ffffff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
  };
}

function metricCardStyle(): React.CSSProperties {
  return {
    padding: 16,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  };
}

export default function AdminDashboard() {
  const [rides, setRides] = useState<Ride[]>([]);

  useEffect(() => {
    seedDrivers();

    function syncRides() {
      setRides(getRides());
    }

    syncRides();

    const timer = window.setInterval(syncRides, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const summary = useMemo(() => {
    const completed = rides.filter((ride) => ride.status === "completed").length;
    const active = rides.filter(
      (ride) =>
        ride.status === "driver_assigned" ||
        ride.status === "driver_arriving" ||
        ride.status === "in_progress"
    ).length;
    const searching = rides.filter((ride) => ride.status === "searching").length;
    const revenuePi = rides
      .filter((ride) => ride.status === "completed")
      .reduce((sum, ride) => sum + ride.pricePi, 0);

    return {
      total: rides.length,
      completed,
      active,
      searching,
      revenuePi: Number(revenuePi.toFixed(2)),
    };
  }, [rides]);

  function handleResetDemo() {
    clearDemoState();
    clearSelectedDriverId();
    seedDrivers();
    setRides([]);
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={containerStyle()}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>TrueGo Admin Dashboard</h2>
            <div style={{ color: "#6b7280" }}>
              Operational overview for the current demo fleet and ride activity.
            </div>
          </div>

          <button
            onClick={handleResetDemo}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#b91c1c",
            }}
          >
            Reset demo data
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={metricCardStyle()}>
            <div style={{ color: "#6b7280", marginBottom: 6 }}>Total rides</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{summary.total}</div>
          </div>

          <div style={metricCardStyle()}>
            <div style={{ color: "#6b7280", marginBottom: 6 }}>Active rides</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{summary.active}</div>
          </div>

          <div style={metricCardStyle()}>
            <div style={{ color: "#6b7280", marginBottom: 6 }}>Searching</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{summary.searching}</div>
          </div>

          <div style={metricCardStyle()}>
            <div style={{ color: "#6b7280", marginBottom: 6 }}>Completed</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{summary.completed}</div>
          </div>

          <div style={metricCardStyle()}>
            <div style={{ color: "#6b7280", marginBottom: 6 }}>Revenue</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{summary.revenuePi} Pi</div>
          </div>
        </div>

        {rides.length === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
            }}
          >
            No rides yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {rides.map((ride) => {
              const driverName = ride.driverId
                ? getDriverById(ride.driverId)?.name ?? "Unknown"
                : "Not assigned";

              return (
                <div
                  key={ride.id}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <StatusBadge status={ride.status} />

                  <div style={{ marginBottom: 6 }}>
                    <strong>Ride ID:</strong> {ride.id}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <strong>Rider ID:</strong> {ride.riderId}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <strong>Driver:</strong> {driverName}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <strong>Pickup:</strong> {ride.pickupText}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <strong>Destination:</strong> {ride.destinationText}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <strong>Fare:</strong> {ride.pricePi} Pi
                  </div>
                  <div>
                    <strong>Distance:</strong> {ride.distanceKm} km
                  </div>

                  <RideTimeline ride={ride} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
