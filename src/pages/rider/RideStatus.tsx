import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import type { Ride } from "../../types/ride";
import RideTimeline from "../../components/RideTimeline";
import StatusBadge from "../../components/StatusBadge";
import {
  getDriverById,
  getRideById,
  seedDrivers,
} from "../../services/mockRealtimeStore";

export default function RideStatus() {
  const params = useParams<{ rideId: string }>();
  const rideId = params.rideId ?? "";

  const [ride, setRide] = useState<Ride | null>(null);
  const [driverName, setDriverName] = useState("");

  useEffect(() => {
    seedDrivers();

    function syncRide() {
      const nextRide = getRideById(rideId);
      setRide(nextRide);

      if (nextRide?.driverId) {
        const driver = getDriverById(nextRide.driverId);
        setDriverName(driver?.name ?? "");
      } else {
        setDriverName("");
      }
    }

    syncRide();

    const timer = window.setInterval(syncRide, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [rideId]);

  if (!ride) {
    return (
      <div style={{ padding: 20 }}>
        <div
          style={{
            maxWidth: 700,
            margin: "40px auto",
            background: "#ffffff",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Ride Status</h2>
          <p>Ride not found.</p>
          <Link to="/rider">Back to Rider App</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          maxWidth: 700,
          margin: "40px auto",
          background: "#ffffff",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Ride Status</h2>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
          }}
        >
          <StatusBadge status={ride.status} />

          <div style={{ marginBottom: 8 }}>
            <strong>Ride ID:</strong> {ride.id}
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Pickup:</strong> {ride.pickupText}
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Destination:</strong> {ride.destinationText}
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Distance:</strong> {ride.distanceKm} km
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Time:</strong> {ride.durationMin} min
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Price:</strong> {ride.pricePi} Pi
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Vehicle:</strong> {ride.vehicleType}
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Driver:</strong> {driverName || "Not assigned yet"}
          </div>

          <RideTimeline ride={ride} />
        </div>

        <div style={{ marginTop: 20 }}>
          <Link to="/rider">Book Another Ride</Link>
        </div>
      </div>
    </div>
  );
}
