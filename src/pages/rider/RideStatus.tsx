import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import type { RideStatus as RideStatusType, Ride } from "../../types/ride";
import {
  getDriverById,
  getRideById,
  seedDrivers,
} from "../../services/mockRealtimeStore";

function labelForStatus(status: RideStatusType): string {
  switch (status) {
    case "searching":
      return "Searching for driver";
    case "driver_assigned":
      return "Driver assigned";
    case "driver_arriving":
      return "Driver is arriving";
    case "in_progress":
      return "Ride in progress";
    case "completed":
      return "Ride completed";
    case "cancelled":
      return "Ride cancelled";
    default:
      return status;
  }
}

function statusColor(status: RideStatusType): string {
  switch (status) {
    case "searching":
      return "#f59e0b";
    case "driver_assigned":
      return "#2563eb";
    case "driver_arriving":
      return "#0ea5e9";
    case "in_progress":
      return "#8b5cf6";
    case "completed":
      return "#10b981";
    case "cancelled":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

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
            maxWidth: 620,
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
          maxWidth: 620,
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
          <div
            style={{
              display: "inline-block",
              padding: "6px 12px",
              borderRadius: 999,
              background: statusColor(ride.status),
              color: "#ffffff",
              marginBottom: 12,
            }}
          >
            {labelForStatus(ride.status)}
          </div>

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
        </div>

        <div style={{ marginTop: 20 }}>
          <Link to="/rider">Book Another Ride</Link>
        </div>
      </div>
    </div>
  );
}