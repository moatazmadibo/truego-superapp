import { useEffect, useState } from "react";

import type { Ride } from "../../types/ride";
import {
  getDriverById,
  getRides,
  seedDrivers,
} from "../../services/mockRealtimeStore";

function containerStyle(): React.CSSProperties {
  return {
    maxWidth: 900,
    margin: "40px auto",
    background: "#ffffff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
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

  return (
    <div style={{ padding: 20 }}>
      <div style={containerStyle()}>
        <h2 style={{ marginTop: 0 }}>TrueGo Admin Dashboard</h2>

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
                    <strong>Status:</strong> {ride.status}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <strong>Fare:</strong> {ride.pricePi} Pi
                  </div>
                  <div>
                    <strong>Distance:</strong> {ride.distanceKm} km
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}