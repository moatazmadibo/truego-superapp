import { useEffect, useState } from "react";
import { formatPiAmount } from "../../lib/piPricing";
import {
  listOpenRideOfferRequestsForDriver,
  submitDemoDriverRideOffer,
  type DemoDriverRow,
  type RideRow,
} from "../../services/rideApi";

function sectionStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  };
}

function requestCardStyle(): React.CSSProperties {
  return {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
    font: "inherit",
    marginTop: 6,
  };
}

function buttonStyle(background: string, disabled = false): React.CSSProperties {
  return {
    border: 0,
    borderRadius: 12,
    padding: "11px 14px",
    color: "#ffffff",
    background,
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

export default function DriverOpenOfferRequestsCard({
  driver,
  onOfferSubmitted,
}: {
  driver: DemoDriverRow;
  onOfferSubmitted?: () => void;
}) {
  const [requests, setRequests] = useState<RideRow[]>([]);
  const [offerPrices, setOfferPrices] = useState<Record<string, string>>({});
  const [etaMinutes, setEtaMinutes] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [actionRideId, setActionRideId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadRequests() {
    setLoading(true);
    setError("");

    try {
      const rows = await listOpenRideOfferRequestsForDriver(driver.id);
      setRequests(rows);

      setOfferPrices((current) => {
        const copy = { ...current };

        for (const ride of rows) {
          if (copy[ride.id] == null) {
            copy[ride.id] = String(Number(ride.price_pi ?? 0));
          }
        }

        return copy;
      });
    } catch (loadError) {
      const text =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load open ride requests.";
      setError(text);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();

    const intervalId = window.setInterval(() => {
      void loadRequests();
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [driver.id]);

  async function submitOffer(ride: RideRow, useSuggestedFare: boolean) {
    const suggestedFare = Number(ride.price_pi ?? 0);
    const rawPrice = useSuggestedFare
      ? suggestedFare
      : Number(offerPrices[ride.id] ?? 0);

    if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
      setError("Enter a valid offer amount.");
      return;
    }

    if (rawPrice < suggestedFare) {
      setError("Offer cannot be lower than the rider's suggested fare.");
      return;
    }

    const parsedEta = etaMinutes[ride.id]?.trim()
      ? Number(etaMinutes[ride.id])
      : null;

    if (
      parsedEta != null &&
      (!Number.isInteger(parsedEta) || parsedEta <= 0 || parsedEta > 120)
    ) {
      setError("ETA must be between 1 and 120 minutes.");
      return;
    }

    setActionRideId(ride.id);
    setError("");
    setMessage("");

    try {
      await submitDemoDriverRideOffer({
        rideId: ride.id,
        driverId: driver.id,
        offerPricePi: rawPrice,
        etaMinutes: parsedEta,
        driverNote: notes[ride.id] || null,
      });

      setMessage("Offer submitted to rider.");
      await loadRequests();
      onOfferSubmitted?.();
    } catch (submitError) {
      const text =
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit driver offer.";
      setError(text);
    } finally {
      setActionRideId("");
    }
  }

  return (
    <div style={sectionStyle()}>
      <h2 style={{ marginTop: 0 }}>Open ride requests</h2>
      <p style={{ marginTop: 6, color: "#475569", lineHeight: 1.6 }}>
        Available rider requests are shown here in the inDrive-style flow.
        Accept the suggested fare or submit a higher counter-offer.
      </p>

      {!driver.is_online ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            lineHeight: 1.6,
          }}
        >
          Go online first to submit offers.
        </div>
      ) : null}

      {loading ? <p>Loading open requests...</p> : null}

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "#ecfdf5",
            border: "1px solid #bbf7d0",
            color: "#047857",
          }}
        >
          {message}
        </div>
      ) : null}

      {!loading && requests.length === 0 ? (
        <p style={{ color: "#64748b" }}>
          No open rider requests are collecting offers right now.
        </p>
      ) : null}

      {requests.map((ride) => {
        const actionLoading = actionRideId === ride.id;
        const suggestedFare = Number(ride.price_pi ?? 0);

        return (
          <div key={ride.id} style={requestCardStyle()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <strong>Ride request</strong>
                <div style={{ marginTop: 6, color: "#475569" }}>
                  {ride.pickup_text} → {ride.destination_text}
                </div>
              </div>

              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#7c3aed",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                Collecting offers
              </span>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
              }}
            >
              <div>
                <strong>Suggested fare</strong>
                <div>{formatPiAmount(suggestedFare)}</div>
              </div>

              <div>
                <strong>Distance / time</strong>
                <div>
                  {ride.distance_km.toFixed(2)} km · {ride.duration_min} min
                </div>
              </div>

              <div>
                <strong>Vehicle type</strong>
                <div>{ride.vehicle_type}</div>
              </div>
            </div>

            <label style={{ display: "block", marginTop: 12, fontWeight: 800 }}>
              Your offer amount Pi
            </label>
            <input
              value={offerPrices[ride.id] ?? ""}
              onChange={(event) =>
                setOfferPrices((current) => ({
                  ...current,
                  [ride.id]: event.target.value,
                }))
              }
              inputMode="decimal"
              style={inputStyle()}
            />

            <label style={{ display: "block", marginTop: 12, fontWeight: 800 }}>
              ETA minutes
            </label>
            <input
              value={etaMinutes[ride.id] ?? ""}
              onChange={(event) =>
                setEtaMinutes((current) => ({
                  ...current,
                  [ride.id]: event.target.value,
                }))
              }
              placeholder="Example: 5"
              inputMode="numeric"
              style={inputStyle()}
            />

            <label style={{ display: "block", marginTop: 12, fontWeight: 800 }}>
              Note to rider
            </label>
            <input
              value={notes[ride.id] ?? ""}
              onChange={(event) =>
                setNotes((current) => ({
                  ...current,
                  [ride.id]: event.target.value,
                }))
              }
              placeholder="Example: I can arrive quickly."
              style={inputStyle()}
            />

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 14,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  void submitOffer(ride, true);
                }}
                disabled={
                  actionLoading || !driver.is_online || !driver.is_available
                }
                style={buttonStyle(
                  "#16a34a",
                  actionLoading || !driver.is_online || !driver.is_available
                )}
              >
                Accept suggested fare
              </button>

              <button
                type="button"
                onClick={() => {
                  void submitOffer(ride, false);
                }}
                disabled={
                  actionLoading || !driver.is_online || !driver.is_available
                }
                style={buttonStyle(
                  "#7c3aed",
                  actionLoading || !driver.is_online || !driver.is_available
                )}
              >
                {actionLoading ? "Submitting..." : "Submit counter-offer"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
