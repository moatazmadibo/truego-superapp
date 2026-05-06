import { useEffect, useMemo, useState } from "react";
import RideTimeline from "../../components/RideTimeline";
import DriverVerificationCard from "./DriverVerificationCard";
import DriverVehicleProfileCard from "./DriverVehicleProfileCard";
import DriverLiveLocationTracker from "./DriverLiveLocationTracker";
import DriverRideMapCard from "./DriverRideMapCard";
import ListingReadinessPanel from "../../components/ListingReadinessPanel";

type DriverTab = "operations" | "verification";
import StatusBadge from "../../components/StatusBadge";
import { formatPiAmount } from "../../lib/piPricing";
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
    maxWidth: 960,
    margin: "32px auto",
    padding: 22,
    background: "#ffffff",
    borderRadius: 22,
    boxShadow: "0 18px 55px rgba(15, 23, 42, 0.12)",
    border: "1px solid #e5e7eb",
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
    padding: "11px 15px",
    borderRadius: 12,
    border: "1px solid transparent",
    background,
    color: "#ffffff",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontWeight: 800,
    boxShadow: disabled ? "none" : "0 10px 20px rgba(15, 23, 42, 0.12)",
  };
}


function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "10px 14px",
    background: active ? "#111827" : "#ffffff",
    color: active ? "#ffffff" : "#111827",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: active ? "0 8px 20px rgba(15, 23, 42, 0.18)" : "none",
  };
}

function detailMiniCardStyle(): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    color: "#334155",
    lineHeight: 1.5,
  };
}

export default function DriverHome() {
  const [activeTab, setActiveTab] = useState<DriverTab>("operations");
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

  const liveLocationTrackingEnabled =
    !!selectedDriver &&
    !!currentRideRow &&
    ["driver_assigned", "driver_arriving", "in_progress"].includes(
      currentRideRow.status
    );

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

      <ListingReadinessPanel context="driver" compact />

      <div
        style={{
          marginTop: 14,
          marginBottom: 16,
          padding: 14,
          borderRadius: 16,
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          color: "#0369a1",
          lineHeight: 1.6,
          fontSize: 14,
        }}
      >
        <strong>Driver operations checkpoint:</strong> drivers must go online
        before receiving offers. Ride assignment happens only after the driver
        reviews the upfront fare and accepts the offer.
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 6,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("operations")}
          style={tabButtonStyle(activeTab === "operations")}
        >
          Ride Operations
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("verification")}
          style={tabButtonStyle(activeTab === "verification")}
        >
          Driver Verification
        </button>
      </div>

      {selectedDriver ? (
        <DriverLiveLocationTracker
          driverId={selectedDriver.id}
          enabled={liveLocationTrackingEnabled}
          showStatus={activeTab === "operations"}
          demoStartLat={
            currentRideRow?.status === "in_progress"
              ? currentRideRow.pickup_lat
              : currentRideRow?.destination_lat
          }
          demoStartLng={
            currentRideRow?.status === "in_progress"
              ? currentRideRow.pickup_lng
              : currentRideRow?.destination_lng
          }
          targetLat={
            currentRideRow?.status === "in_progress"
              ? currentRideRow.destination_lat
              : currentRideRow?.pickup_lat
          }
          targetLng={
            currentRideRow?.status === "in_progress"
              ? currentRideRow.destination_lng
              : currentRideRow?.pickup_lng
          }
          targetLabel={
            currentRideRow?.status === "in_progress"
              ? "destination"
              : "pickup"
          }
        />
      ) : null}

      {activeTab === "operations" && selectedDriver && currentRideRow ? (
        <DriverRideMapCard driverId={selectedDriver.id} ride={currentRideRow} />
      ) : null}

      {activeTab === "verification" ? (
        <div
          style={{
            marginTop: 14,
            marginBottom: 16,
            padding: 14,
            borderRadius: 16,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            lineHeight: 1.6,
            fontSize: 14,
          }}
        >
          <strong>Driver verification lifecycle note:</strong> verification is
          completed once during onboarding, then updated only when needed, such
          as license renewal, vehicle replacement, identity/passport update, or
          an admin request for additional documents.
        </div>
      ) : null}


      {activeTab === "operations" ? (
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
          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 10,
            }}
          >
            <div style={detailMiniCardStyle()}>
              <strong>Current driver</strong>
              <div style={{ marginTop: 6 }}>{selectedDriver.display_name}</div>
            </div>

            <div style={detailMiniCardStyle()}>
              <strong>Vehicle</strong>
              <div style={{ marginTop: 6 }}>{selectedDriver.vehicle_type}</div>
            </div>

            <div style={detailMiniCardStyle()}>
              <strong>Rating</strong>
              <div style={{ marginTop: 6 }}>{selectedDriver.rating.toFixed(1)}</div>
            </div>

            <div style={detailMiniCardStyle()}>
              <strong>Availability</strong>
              <div style={{ marginTop: 6 }}>
                {selectedDriver.is_available ? "Available" : "Busy"}
              </div>
            </div>

            <div style={detailMiniCardStyle()}>
              <strong>Presence</strong>
              <div style={{ marginTop: 6 }}>
                {selectedDriverIsFreshOnline ? "Fresh / Active" : "Stale / Offline"}
              </div>
            </div>
          </div>
        ) : (
          <p style={{ marginTop: 16, marginBottom: 0 }}>No driver selected.</p>
        )}
      </div>
      ) : null}

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

      {activeTab === "verification" ? (
        !loading && selectedDriver ? (
          <>
            <DriverVehicleProfileCard driver={selectedDriver} />
            <DriverVerificationCard driver={selectedDriver} />
          </>
        ) : (
          <div style={sectionStyle()}>
            <h2 style={{ marginTop: 0 }}>Driver Verification</h2>
            <p style={{ marginBottom: 0, color: "#475569", lineHeight: 1.6 }}>
              Select a driver first to review verification status and upload documents.
            </p>
          </div>
        )
      ) : null}

      {activeTab === "operations" ? (
        <>
      {!loading && selectedDriver && !currentRideRow ? (
        <div style={sectionStyle()}>
          <h2 style={{ marginTop: 0 }}>No active ride yet</h2>
          <p style={{ marginBottom: 0, color: "#475569", lineHeight: 1.6 }}>
            You are online and ready. New ride offers will appear here with
            upfront fare, driver payout, pickup, and destination details before
            you accept.
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

          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 14,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              color: "#334155",
              lineHeight: 1.6,
              fontSize: 14,
            }}
          >
            <strong>Current ride operations note:</strong> the driver can accept
            or decline offers. Accepted trips progress through arrival, start,
            completion, and then rider payment.
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
              New ride offer · Fare: {formatPiAmount(Number(currentRideRow.price_pi))}
              {currentRideRow.driver_payout_pi != null
                ? ` · Driver payout: ${formatPiAmount(Number(currentRideRow.driver_payout_pi))}`
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
              <strong>Price:</strong> {formatPiAmount(Number(currentRideRow.price_pi))}
            </div>
            <div>
              <strong>Driver payout:</strong>{" "}
              {currentRideRow.driver_payout_pi != null
                ? formatPiAmount(Number(currentRideRow.driver_payout_pi))
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
        </>
      ) : null}
    </div>
  );
}
