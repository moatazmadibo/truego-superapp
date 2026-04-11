import { useEffect, useMemo, useState } from "react";

import RideTimeline from "../../components/RideTimeline";
import StatusBadge from "../../components/StatusBadge";
import type { Ride } from "../../types/ride";
import {
  acceptDemoRide,
  completeDemoRide,
  listDemoDrivers,
  listRecentRides,
  subscribeToLatestRides,
  updateRideStage,
  type DemoDriverRow,
  type RideRow,
} from "../../services/rideApi";

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
  return localStorage.getItem("truego_demo_driver") ?? "";
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
  const [drivers, setDrivers] = useState<DemoDriverRow[]>([]);
  const [rides, setRides] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadAll() {
    try {
      setErrorMessage("");
      const [driversData, ridesData] = await Promise.all([
        listDemoDrivers(),
        listRecentRides(20),
      ]);

      setDrivers(driversData);
      setRides(ridesData);

      if (!selectedDriverId && driversData.length > 0) {
        setSelectedDriverId(driversData[0].id);
      }

      if (
        selectedDriverId &&
        driversData.length > 0 &&
        !driversData.some((driver) => driver.id === selectedDriverId)
      ) {
        setSelectedDriverId(driversData[0].id);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load driver console.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();

    const unsubscribe = subscribeToLatestRides(() => {
      void loadAll();
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (selectedDriverId) {
      localStorage.setItem("truego_demo_driver", selectedDriverId);
    }
  }, [selectedDriverId]);

  const selectedDriver = useMemo(() => {
    return drivers.find((driver) => driver.id === selectedDriverId) ?? null;
  }, [drivers, selectedDriverId]);

  const lastCompletedRideAt = useMemo(() => {
    if (!selectedDriver) {
      return 0;
    }

    return rides
      .filter(
        (ride) =>
          ride.driver_name === selectedDriver.display_name && ride.completed_at
      )
      .map((ride) => Date.parse(ride.completed_at as string))
      .reduce((latest, value) => (value > latest ? value : latest), 0);
  }, [rides, selectedDriver]);

  const currentRideRow = useMemo(() => {
    if (!selectedDriver) {
      return null;
    }

    const assignedRide =
      rides.find((ride) => {
        return (
          ride.driver_name === selectedDriver.display_name &&
          ["driver_assigned", "driver_arriving", "in_progress"].includes(
            ride.status
          )
        );
      }) ?? null;

    if (assignedRide) {
      return assignedRide;
    }

    if (!selectedDriver.is_available) {
      return null;
    }

    return (
      rides.find((ride) => {
        return (
          ride.status === "searching" &&
          !ride.driver_name &&
          ride.vehicle_type === selectedDriver.vehicle_type &&
          Date.parse(ride.created_at) >= lastCompletedRideAt
        );
      }) ?? null
    );
  }, [rides, selectedDriver, lastCompletedRideAt]);

  const currentRide = useMemo(() => {
    if (!currentRideRow) {
      return null;
    }

    return mapRideRowToRide(currentRideRow);
  }, [currentRideRow]);

  const selectedDriverIsAvailable = selectedDriver?.is_available ?? false;

  async function handleAcceptRide() {
    if (!currentRideRow || !selectedDriver) {
      return;
    }

    setActionLoading(true);
    setErrorMessage("");

    try {
      await acceptDemoRide(currentRideRow.id, selectedDriver.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to accept ride.";
      console.error("Accept ride failed:", error);
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
    if (!currentRideRow || !selectedDriver) {
      return;
    }

    setActionLoading(true);
    setErrorMessage("");

    try {
      await completeDemoRide(currentRideRow.id, selectedDriver.id);
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
          disabled={drivers.length === 0}
        >
          {drivers.length === 0 ? (
            <option value="">No demo drivers available</option>
          ) : null}

          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.display_name} - {driver.vehicle_type} -{" "}
              {driver.is_available ? "Available" : "Busy"}
            </option>
          ))}
        </select>

        {selectedDriver ? (
          <div style={{ color: "#374151", lineHeight: 1.8 }}>
            <div>
              <strong>Current driver:</strong> {selectedDriver.display_name}
            </div>
            <div>
              <strong>Vehicle:</strong> {selectedDriver.vehicle_type}
            </div>
            <div>
              <strong>Rating:</strong> {selectedDriver.rating.toFixed(1)}
            </div>
            <div>
              <strong>Availability:</strong>{" "}
              {selectedDriver.is_available ? "Available" : "Busy"}
            </div>
          </div>
        ) : (
          <div style={{ color: "#6b7280" }}>No driver selected.</div>
        )}
      </div>

      {loading ? <p>Loading rides...</p> : null}
      {errorMessage ? <p style={{ color: "crimson" }}>{errorMessage}</p> : null}

      {!loading && !selectedDriver ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 20,
            background: "#fff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>No drivers found</h2>
          <p>There are no demo drivers in Supabase yet.</p>
        </div>
      ) : null}

      {!loading && selectedDriver && !currentRideRow ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 20,
            background: "#fff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>No assigned ride yet</h2>
          <p>No active ride is available for this driver right now.</p>
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
                disabled={actionLoading || !selectedDriverIsAvailable}
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