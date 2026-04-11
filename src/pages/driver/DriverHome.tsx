import { useEffect, useMemo, useState } from "react";

import RideTimeline from "../../components/RideTimeline";
import StatusBadge from "../../components/StatusBadge";
import type { Ride } from "../../types/ride";
import {
  assignDriverToRide,
  listRecentRides,
  subscribeToLatestRides,
  updateRideStage,
  type RideRow,
} from "../../services/rideApi";

type DemoDriver = {
  sessionId: string;
  displayName: string;
  vehicleLabel: string;
};

const DEMO_DRIVERS: DemoDriver[] = [
  { sessionId: "ahmed", displayName: "Ahmed", vehicleLabel: "Car" },
  { sessionId: "mohamed", displayName: "Mohamed", vehicleLabel: "Car" },
  { sessionId: "ali", displayName: "Ali", vehicleLabel: "Motorcycle" },
];

function mapRideRowToRide(row: RideRow): Ride {
  return {
    id: row.id,
    riderId: row.rider_user_id ?? "demo-rider",
    driverId: row.driver_user_id ?? undefined,
    pickupText: row.pickup_text,
    destinationText: row.destination_text,
    pickup: {
      lat: row.pickup_lat ?? 0,
      lng: row.pickup_lng ?? 0,
    },
    destination: {
      lat: row.destination_lat ?? 0,
      lng: row.destination_lng ?? 0,
    },
    distanceKm: row.distance_km,
    durationMin: row.duration_min,
    pricePi: row.price_pi,
    vehicleType: row.vehicle_type,
    status: row.status,
    createdAt: Date.parse(row.created_at),
    acceptedAt: row.accepted_at ? Date.parse(row.accepted_at) : undefined,
    startedAt: row.started_at ? Date.parse(row.started_at) : undefined,
    completedAt: row.completed_at ? Date.parse(row.completed_at) : undefined,
  };
}

function getStoredDriverSessionId() {
  const stored = localStorage.getItem("truego_demo_driver");
  if (stored && DEMO_DRIVERS.some((driver) => driver.sessionId === stored)) {
    return stored;
  }

  return DEMO_DRIVERS[0].sessionId;
}

function formatRideStatus(status: RideRow["status"]) {
  switch (status) {
    case "searching":
      return "Searching for driver";
    case "driver_assigned":
      return "Driver assigned";
    case "driver_arriving":
      return "Driver arriving";
    case "in_progress":
      return "Ride in progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export default function DriverHome() {
  const [selectedDriverId, setSelectedDriverId] = useState(getStoredDriverSessionId);
  const [rides, setRides] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedDriver = useMemo(
    () =>
      DEMO_DRIVERS.find((driver) => driver.sessionId === selectedDriverId) ??
      DEMO_DRIVERS[0],
    [selectedDriverId]
  );

  async function loadRides() {
    try {
      setErrorMessage("");
      const data = await listRecentRides(20);
      setRides(data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load rides.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    localStorage.setItem("truego_demo_driver", selectedDriverId);
  }, [selectedDriverId]);

  useEffect(() => {
    void loadRides();

    const unsubscribe = subscribeToLatestRides(() => {
      void loadRides();
    });

    return unsubscribe;
  }, []);

  const currentRideRow = useMemo(() => {
    return (
      rides.find((ride) => {
        const isActive = ["searching", "driver_assigned", "driver_arriving", "in_progress"].includes(
          ride.status
        );

        if (!isActive) {
          return false;
        }

        if (!ride.driver_name) {
          return true;
        }

        return ride.driver_name === selectedDriver.displayName;
      }) ?? null
    );
  }, [rides, selectedDriver.displayName]);

  const currentRide = useMemo(() => {
    if (!currentRideRow) {
      return null;
    }

    return mapRideRowToRide(currentRideRow);
  }, [currentRideRow]);

  async function handleAcceptRide() {
    if (!currentRideRow) {
      return;
    }

    setActionLoading(true);
    setErrorMessage("");

    try {
      await assignDriverToRide(currentRideRow.id, {
        driver_user_id: null,
        driver_name: selectedDriver.displayName,
      });

      await updateRideStage(currentRideRow.id, "driver_arriving");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to accept ride.";
      setErrorMessage(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartRide() {
    if (!currentRideRow) {
      return;
    }

    setActionLoading(true);
    setErrorMessage("");

    try {
      await updateRideStage(currentRideRow.id, "in_progress");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start ride.";
      setErrorMessage(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCompleteRide() {
    if (!currentRideRow) {
      return;
    }

    setActionLoading(true);
    setErrorMessage("");

    try {
      await updateRideStage(currentRideRow.id, "completed");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to complete ride.";
      setErrorMessage(message);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginBottom: 20 }}>TrueGo Driver Console</h1>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 16,
          background: "#fff",
          marginBottom: 20,
        }}
      >
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
          Active demo driver
        </label>

        <select
          value={selectedDriverId}
          onChange={(event) => setSelectedDriverId(event.target.value)}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #d1d5db",
            marginBottom: 12,
          }}
        >
          {DEMO_DRIVERS.map((driver) => (
            <option key={driver.sessionId} value={driver.sessionId}>
              {driver.displayName} - {driver.vehicleLabel}
            </option>
          ))}
        </select>

        <div style={{ color: "#374151" }}>
          <strong>Current driver:</strong> {selectedDriver.displayName}
        </div>
      </div>

      {loading ? <p>Loading rides...</p> : null}
      {errorMessage ? <p style={{ color: "crimson" }}>{errorMessage}</p> : null}

      {!loading && !currentRideRow ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 20,
            background: "#fff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>No assigned ride yet</h2>
          <p>No active ride is available for this demo driver right now.</p>
        </div>
      ) : null}

      {!loading && currentRideRow && currentRide ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 20,
            background: "#fff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Current Ride</h2>

          <div style={{ marginBottom: 12 }}>
            <StatusBadge status={currentRide.status} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Status:</strong> {formatRideStatus(currentRideRow.status)}
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Ride ID:</strong> {currentRideRow.id}
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Pickup:</strong> {currentRideRow.pickup_text}
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Destination:</strong> {currentRideRow.destination_text}
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Price:</strong> {currentRideRow.price_pi.toFixed(2)} Pi
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Driver:</strong> {currentRideRow.driver_name ?? "Not assigned"}
          </div>

          <RideTimeline ride={currentRide} />

          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            {currentRideRow.status === "searching" ? (
              <button
                onClick={handleAcceptRide}
                disabled={actionLoading}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "#111827",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {actionLoading ? "Accepting..." : "Accept Ride"}
              </button>
            ) : null}

            {["driver_assigned", "driver_arriving"].includes(currentRideRow.status) ? (
              <button
                onClick={handleStartRide}
                disabled={actionLoading}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "#0ea5e9",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {actionLoading ? "Starting..." : "Start Ride"}
              </button>
            ) : null}

            {currentRideRow.status === "in_progress" ? (
              <button
                onClick={handleCompleteRide}
                disabled={actionLoading}
                style={{
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "#10b981",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {actionLoading ? "Completing..." : "Complete Ride"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}