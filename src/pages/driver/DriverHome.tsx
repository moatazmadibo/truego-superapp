import { useEffect, useMemo, useState } from "react";

import type { Driver, Ride } from "../../types/ride";
import RideTimeline from "../../components/RideTimeline";
import StatusBadge from "../../components/StatusBadge";
import {
  getActiveRideForDriver,
  getDrivers,
  seedDrivers,
  updateRideStatus,
} from "../../services/mockRealtimeStore";
import {
  clearSelectedDriverId,
  getSelectedDriverId,
  setSelectedDriverId,
} from "../../services/demoSession";

function panelStyle(): React.CSSProperties {
  return {
    maxWidth: 760,
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
    fontWeight: 600,
  };
}

function ghostButtonStyle(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
  };
}

export default function DriverHome() {
  const [drivers, setDrivers] = useState<Driver[]>(() => {
    seedDrivers();
    return getDrivers();
  });
  const [selectedDriverId, setCurrentSelectedDriverId] = useState(() => {
    seedDrivers();
    return getSelectedDriverId();
  });
  const [ride, setRide] = useState<Ride | null>(null);

  useEffect(() => {
    function syncData() {
      seedDrivers();
      const currentDrivers = getDrivers();
      setDrivers(currentDrivers);

      if (!selectedDriverId) {
        setRide(null);
        return;
      }

      setRide(getActiveRideForDriver(selectedDriverId));
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

  function handleSelectDriver(driverId: string) {
    setSelectedDriverId(driverId);
    setCurrentSelectedDriverId(driverId);
  }

  function handleSwitchDriver() {
    clearSelectedDriverId();
    setCurrentSelectedDriverId("");
    setRide(null);
  }

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

  if (!selectedDriver) {
    return (
      <div style={{ padding: 20 }}>
        <div style={panelStyle()}>
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>TrueGo Driver Console</h2>
          <p style={{ marginTop: 0, color: "#6b7280" }}>
            Choose your driver profile once to enter the operational console.
            This replaces the raw driver dropdown and feels closer to a real
            driver login flow.
          </p>

          <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
            {drivers.map((driver) => (
              <button
                key={driver.id}
                onClick={() => handleSelectDriver(driver.id)}
                style={{
                  textAlign: "left",
                  padding: 16,
                  borderRadius: 14,
                  border: "1px solid #e5e7eb",
                  background: "#f8fafc",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{driver.name}</div>
                <div style={{ color: "#4b5563", marginBottom: 4 }}>
                  Vehicle: {driver.vehicleType}
                </div>
                <div style={{ color: "#4b5563", marginBottom: 4 }}>
                  Rating: {driver.rating}
                </div>
                <div style={{ color: driver.isAvailable ? "#059669" : "#b45309" }}>
                  {driver.isAvailable ? "Available" : "Busy"}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={panelStyle()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>TrueGo Driver</h2>
            <div style={{ color: "#6b7280", marginTop: 6 }}>
              Operational console for the active driver profile.
            </div>
          </div>

          <button onClick={handleSwitchDriver} style={ghostButtonStyle()}>
            Switch driver
          </button>
        </div>

        <div
          style={{
            marginBottom: 16,
            padding: 16,
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

        {!ride ? (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>No assigned ride yet</div>
            <div style={{ color: "#6b7280" }}>
              The driver is ready and waiting for the next matched trip.
            </div>
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

            <div style={{ marginBottom: 16 }}>
              <strong>Price:</strong> {ride.pricePi} Pi
            </div>

            {ride.status === "driver_assigned" ? (
              <button onClick={handleAcceptRide} style={actionButtonStyle("#0ea5e9")}>
                Accept Ride
              </button>
            ) : null}

            {ride.status === "driver_arriving" ? (
              <button onClick={handleStartRide} style={actionButtonStyle("#8b5cf6")}>
                Start Ride
              </button>
            ) : null}

            {ride.status === "in_progress" ? (
              <button onClick={handleCompleteRide} style={actionButtonStyle("#10b981")}>
                Complete Ride
              </button>
            ) : null}

            {ride.status === "completed" ? (
              <div style={{ color: "#10b981", fontWeight: 700 }}>
                Ride completed successfully.
              </div>
            ) : null}

            <RideTimeline ride={ride} />
          </div>
        )}
      </div>
    </div>
  );
}
