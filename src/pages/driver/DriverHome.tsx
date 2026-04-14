import { useEffect, useMemo, useState } from "react";

import RideTimeline from "../../components/RideTimeline";
import StatusBadge from "../../components/StatusBadge";
import type { Ride } from "../../types/ride";
import {
  acceptDemoRide,
  completeDemoRide,
  listDemoDrivers,
  listRecentRides,
  setDemoDriverOnlineStatus,
  subscribeToLatestRides,
  syncDemoRideOfferState,
  touchDemoDriverPresence,
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
    case "offer_sent":
      return "Offer sent to driver";
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
  const currentRideRow = useMemo(() => {
    if (!selectedDriver) {
      return null;
    }

    const assignedRide =
      rides.find((ride) => {
        return (
          ride.demo_driver_id === selectedDriver.id &&
          ["driver_assigned", "driver_arriving", "in_progress"].includes(
            ride.status
          )
        );
      }) ?? null;

    if (assignedRide) {
      return assignedRide;
    }

    const offeredRide =
      rides.find((ride) => {
        if (
          ride.status !== "offer_sent" ||
          ride.offered_demo_driver_id !== selectedDriver.id
        ) {
          return false;
        }

        if (!ride.offer_expires_at) {
          return true;
        }

        return Date.parse(ride.offer_expires_at) > Date.now();
      }) ?? null;

    if (offeredRide) {
      return offeredRide;
    }

    return null;
  }, [rides, selectedDriver]);

  const currentRide = useMemo(() => {
    if (!currentRideRow) {
      return null;
    }

    return mapRideRowToRide(currentRideRow);
  }, [currentRideRow]);

  useEffect(() => {
    if (!currentRideRow || currentRideRow.status !== "offer_sent") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          await syncDemoRideOfferState(currentRideRow.id);
          await loadAll();
        } catch (error) {
          console.error("Failed to sync ride offer state in driver console:", error);
        }
      })();
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentRideRow?.id, currentRideRow?.status]);

  const selectedDriverIsAvailable = selectedDriver?.is_available ?? false;
  const selectedDriverIsOnline = selectedDriver?.is_online ?? false;

  useEffect(() => {
    if (!selectedDriverId || !selectedDriverIsOnline) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setDrivers((current) =>
        current.map((driver) =>
          driver.id === selectedDriverId
            ? { ...driver, last_seen_at: new Date().toISOString() }
            : driver
        )
      );

      void touchDemoDriverPresence(selectedDriverId);
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedDriverId, selectedDriverIsOnline]);

  async function handleToggleOnlineStatus() {
    if (!selectedDriver) {
      return;
    }

    const nextOnline = !selectedDriver.is_online;
    const timestamp = new Date().toISOString();

    setActionLoading(true);
    setErrorMessage("");

    setDrivers((current) =>
      current.map((driver) =>
        driver.id === selectedDriver.id
          ? {
              ...driver,
              is_online: nextOnline,
              last_seen_at: timestamp,
            }
          : driver
      )
    );

    try {
      await setDemoDriverOnlineStatus(selectedDriver.id, nextOnline);
      await loadAll();
    } catch (error) {
      setDrivers((current) =>
        current.map((driver) =>
          driver.id === selectedDriver.id
            ? {
                ...driver,
                is_online: selectedDriver.is_online,
                last_seen_at: selectedDriver.last_seen_at,
              }
            : driver
        )
      );

      const message =
        error instanceof Error ? error.message : "Failed to update driver status.";
      setErrorMessage(message);
    } finally {
      setActionLoading(false);
    }
  }

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
      {currentRideRow?.status === "offer_sent" ? (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1d4ed8",
            padding: 12,
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          New trip offer: {currentRideRow.price_pi.toFixed(2)} Pi rider fare
          {currentRideRow.driver_payout_pi != null
            ? ` · ${currentRideRow.driver_payout_pi.toFixed(2)} Pi driver payout`
            : ""}
        </div>
      ) : null}

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
          disabled={drivers.length === 0 || actionLoading}
        >
          {drivers.length === 0 ? (
            <option value="">No demo drivers available</option>
          ) : null}

          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.display_name} - {driver.vehicle_type} -{" "}
              {driver.is_online ? "Online" : "Offline"} -{" "}
              {driver.is_available ? "Available" : "Busy"}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void handleToggleOnlineStatus()}
          disabled={!selectedDriver || actionLoading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: selectedDriverIsOnline ? "#111827" : "#2563eb",
            color: "#fff",
            cursor: !selectedDriver || actionLoading ? "not-allowed" : "pointer",
            opacity: !selectedDriver || actionLoading ? 0.6 : 1,
            marginBottom: 12,
          }}
        >
          {selectedDriverIsOnline ? "Go Offline" : "Go Online"}
        </button>

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