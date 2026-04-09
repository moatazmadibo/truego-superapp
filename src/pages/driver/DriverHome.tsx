import { useEffect, useMemo, useState } from "react";

import type { Driver, Ride } from "../../types/ride";
import {
  getActiveRideForDriver,
  getDrivers,
  seedDrivers,
  updateRideStatus,
} from "../../services/mockRealtimeStore";

function panelStyle(): React.CSSProperties {
  return {
    maxWidth: 720,
    margin: "40px auto",
    background: "#ffffff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
  };
}

function actionButtonStyle(background: string): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 10,
    border: "none",
    background,
    color: "#ffffff",
    width: "100%",
  };
}

export default function DriverHome() {
  const [drivers, setDrivers] = useState<Driver[]>(() => {
    seedDrivers();
    return getDrivers();
  });
  const [selectedDriverId, setSelectedDriverId] = useState(() => {
    seedDrivers();
    return getDrivers()[0]?.id ?? "";
  });
  const [ride, setRide] = useState<Ride | null>(null);

  useEffect(() => {
    function syncData() {
      const currentDrivers = getDrivers();
      setDrivers(currentDrivers);

      if (!selectedDriverId && currentDrivers[0]) {
        setSelectedDriverId(currentDrivers[0].id);
        return;
      }

      if (selectedDriverId) {
        setRide(getActiveRideForDriver(selectedDriverId));
      }
    }

    syncData();

    const timer = window.setInterval(syncData, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [selectedDriverId]);

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === selectedDriverId) ?? null,
    [drivers, selectedDriverId]
  );

  function handleAcceptRide() {
    if (!ride) {
      return;
    }

    const updatedRide = updateRideStatus(ride.id, "driver_arriving");
    setRide(updatedRide);
  }

  function handleStartRide() {
    if (!ride) {
      return;
    }

    const updatedRide = updateRideStatus(ride.id, "in_progress");
    setRide(updatedRide);
  }

  function handleCompleteRide() {
    if (!ride) {
      return;
    }

    const updatedRide = updateRideStatus(ride.id, "completed");
    setRide(updatedRide);
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={panelStyle()}>
        <h2 style={{ marginTop: 0 }}>TrueGo Driver</h2>

        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="driver-select"
            style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
          >
            Select Driver
          </label>

          <select
            id="driver-select"
            value={selectedDriverId}
            onChange={(event) => setSelectedDriverId(event.target.value)}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "1px solid #d1d5db",
            }}
          >
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name} - {driver.vehicleType} -{" "}
                {driver.isAvailable ? "Available" : "Busy"}
              </option>
            ))}
          </select>
        </div>

        {selectedDriver ? (
          <div
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 12,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ marginBottom: 6 }}>
              <strong>Name:</strong> {selectedDriver.name}
            </div>
            <div style={{ marginBottom: 6 }}>
              <strong>Vehicle:</strong> {selectedDriver.vehicleType}
            </div>
            <div style={{ marginBottom: 6 }}>
              <strong>Rating:</strong> {selectedDriver.rating}
            </div>
            <div>
              <strong>Status:</strong>{" "}
              {selectedDriver.isAvailable ? "Available" : "Busy"}
            </div>
          </div>
        ) : null}

        {!ride ? (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
            }}
          >
            No assigned ride yet.
          </div>
        ) : (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
            }}
          >
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

            <div style={{ marginBottom: 16 }}>
              <strong>Status:</strong> {ride.status}
            </div>

            {ride.status === "driver_assigned" ? (
              <button
                onClick={handleAcceptRide}
                style={actionButtonStyle("#0ea5e9")}
              >
                Accept Ride
              </button>
            ) : null}

            {ride.status === "driver_arriving" ? (
              <button
                onClick={handleStartRide}
                style={actionButtonStyle("#8b5cf6")}
              >
                Start Ride
              </button>
            ) : null}

            {ride.status === "in_progress" ? (
              <button
                onClick={handleCompleteRide}
                style={actionButtonStyle("#10b981")}
              >
                Complete Ride
              </button>
            ) : null}

            {ride.status === "completed" ? (
              <div style={{ color: "#10b981", fontWeight: 700 }}>
                Ride completed successfully.
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}