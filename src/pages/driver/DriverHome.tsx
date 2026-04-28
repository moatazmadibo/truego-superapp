import { useEffect, useMemo, useState } from "react";
import RideTimeline from "../../components/RideTimeline";
import StatusBadge from "../../components/StatusBadge";
import type { Ride } from "../../types/ride";
import {
  acceptDemoRide,
  completeDemoRide,
  declineOfferedDemoRide,
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
    case "no_driver_available":
      return "No driver available";
    default:
      return status;
  }
}

function isPresenceFresh(lastSeenAt?: string | null) {
  if (!lastSeenAt) {
    return false;
  }

  const ageMs = Date.now() - Date.parse(lastSeenAt);
  return ageMs <= 90_000;
}

function cardStyle(): React.CSSProperties {
  return {
    maxWidth: 880,
    margin: "32px auto",
    padding: 20,
    background: "#ffffff",
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
  };
}

function sectionStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  };
}

function buttonStyle(
  background: string,
  disabled = false
): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid transparent",
    background,
    color: "#ffffff",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontWeight: 600,
  };
}

export default function DriverHome() {
  const [selectedDriverId, setSelectedDriverId] = useState<string>(
    getStoredDriverSessionId
  );
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
        error instanceof Error
          ? error.message
          : "Failed to load driver console.";
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

  const selectedDriverIsFreshOnline = useMemo(() => {
    if (!selectedDriver) {
      return false;
    }

    return selectedDriver.is_online && isPresenceFresh(selectedDriver.last_seen_at);
  }, [selectedDriver]);

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

  useEffect(() => {
    if (!selectedDriverId || !selectedDriver?.is_online) {
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
  }, [selectedDriverId, selectedDriver?.is_online]);

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
        error instanceof Error
          ? error.message
          : "Failed to update driver status.";
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
      await loadAll();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to accept ride.";
      console.error("Accept ride failed:", error);
      setErrorMessage(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeclineOffer() {
    if (!currentRideRow || !selectedDriver || currentRideRow.status !== "offer_sent") {
      return;
    }

    setActionLoading(true);
    setErrorMessage("");

    try {
      await declineOfferedDemoRide(currentRideRow.id, selectedDriver.id);
      await syncDemoRideOfferState(currentRideRow.id);
      await loadAll();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to decline offer.";
      console.error("Decline offer failed:", error);
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
      await loadAll();
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
      await loadAll();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to complete ride.";
      setErrorMessage(message);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div style={cardStyle()}>
      <h1 style={{ marginTop: 0, marginBottom: 16 }}>TrueGo Driver</h1>

      <div style={sectionStyle()}>
        <label
          htmlFor="driver-select"
          style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
        >
          Active driver
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
            marginBottom: 12,
          }}
          disabled={drivers.length === 0 || actionLoading}
        >
          {drivers.length === 0 ? (
            <option value="">No drivers available</option>
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
          onClick={() => {
            void handleToggleOnlineStatus();
          }}
          disabled={!selectedDriver || actionLoading}
          style={buttonStyle(
            selectedDriver?.is_online ? "#111827" : "#2563eb",
            !selectedDriver || actionLoading
          )}
        >
          {selectedDriver?.is_online ? "Go Offline" : "Go Online"}
        </button>

        {selectedDriver ? (
          <div style={{ marginTop: 16, lineHeight: 1.8 }}>
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
              <strong>Manual availability:</strong>{" "}
              {selectedDriver.is_available ? "Available" : "Busy"}
            </div>
            <div>
              <strong>Presence:</strong>{" "}
              {selectedDriverIsFreshOnline ? "Fresh / Active" : "Stale / Offline"}
            </div>
          </div>
        ) : (
          <p style={{ marginTop: 16, marginBottom: 0 }}>No driver selected.</p>
        )}
      </div>

      {loading ? (
        <div style={sectionStyle()}>
          <p style={{ margin: 0 }}>Loading rides...</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div
          style={{
            ...sectionStyle(),
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      {!loading && !selectedDriver ? (
        <div style={sectionStyle()}>
          <h2 style={{ marginTop: 0 }}>No drivers found</h2>
          <p style={{ marginBottom: 0 }}>
            There are no drivers available yet.
          </p>
        </div>
      ) : null}

      {!loading && selectedDriver && !currentRideRow ? (
        <div style={sectionStyle()}>
          <h2 style={{ marginTop: 0 }}>No active ride yet</h2>
          <p style={{ marginBottom: 0 }}>
            You are online and ready. New ride offers will appear here.
          </p>
        </div>
      ) : null}

      {!loading && currentRideRow && currentRide ? (
        <div style={sectionStyle()}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ margin: 0 }}>Current Ride</h2>
            <StatusBadge status={currentRide.status} />
          </div>

          {currentRideRow.status === "offer_sent" ? (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                color: "#1d4ed8",
                fontWeight: 600,
              }}
            >
              New ride offer: {currentRideRow.price_pi.toFixed(2)} Pi fare
              {currentRideRow.driver_payout_pi != null
                ? ` · ${currentRideRow.driver_payout_pi.toFixed(2)} Pi driver payout`
                : ""}
            </div>
          ) : null}

          <div style={{ marginTop: 16, lineHeight: 1.8 }}>
            <div>
              <strong>Status:</strong> {formatRideStatus(currentRideRow.status)}
            </div>
            <div>
              <strong>Ride ID:</strong> {currentRideRow.id}
            </div>
            <div>
              <strong>Pickup:</strong> {currentRideRow.pickup_text}
            </div>
            <div>
              <strong>Destination:</strong> {currentRideRow.destination_text}
            </div>
            <div>
              <strong>Price:</strong> {currentRideRow.price_pi.toFixed(2)} Pi
            </div>
            <div>
              <strong>Driver payout:</strong>{" "}
              {currentRideRow.driver_payout_pi != null
                ? `${currentRideRow.driver_payout_pi.toFixed(2)} Pi`
                : "N/A"}
            </div>
            <div>
              <strong>Driver:</strong> {currentRideRow.driver_name ?? "Not assigned"}
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {currentRideRow.status === "offer_sent" ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void handleAcceptRide();
                  }}
                  disabled={actionLoading}
                  style={buttonStyle("#16a34a", actionLoading)}
                >
                  {actionLoading ? "Accepting..." : "Accept Offer"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void handleDeclineOffer();
                  }}
                  disabled={actionLoading}
                  style={buttonStyle("#dc2626", actionLoading)}
                >
                  {actionLoading ? "Declining..." : "Decline"}
                </button>
              </>
            ) : null}

            {["driver_assigned", "driver_arriving"].includes(currentRideRow.status) ? (
              <button
                type="button"
                onClick={() => {
                  void handleStartRide();
                }}
                disabled={actionLoading}
                style={buttonStyle("#2563eb", actionLoading)}
              >
                {actionLoading ? "Starting..." : "Start Ride"}
              </button>
            ) : null}

            {currentRideRow.status === "in_progress" ? (
              <button
                type="button"
                onClick={() => {
                  void handleCompleteRide();
                }}
                disabled={actionLoading}
                style={buttonStyle("#7c3aed", actionLoading)}
              >
                {actionLoading ? "Completing..." : "Complete Ride"}
              </button>
            ) : null}
          </div>

          <div style={{ marginTop: 16 }}>
            <RideTimeline ride={currentRide} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
