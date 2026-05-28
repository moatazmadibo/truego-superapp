import { useEffect, useState } from "react";
import { formatPiAmount } from "../../lib/piPricing";
import {
  ensureDemoDriverReadyForOffers,
  listOpenRideOfferRequestsForDriver,
  submitDemoDriverRideOffer,
  type DemoDriverRow,
  type RideRow,
} from "../../services/rideApi";

const QUICK_INCREASES = [
  { label: "Same fare", multiplier: 1 },
  { label: "+5%", multiplier: 1.05 },
  { label: "+10%", multiplier: 1.1 },
  { label: "+15%", multiplier: 1.15 },
  { label: "+20%", multiplier: 1.2 },
];

function sectionStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 18,
    borderRadius: 24,
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    border: "1px solid #e5e7eb",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
  };
}

function requestCardStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.10)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
    font: "inherit",
    marginTop: 6,
    background: "#ffffff",
    outline: "none",
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

function quickButtonStyle(disabled = false): React.CSSProperties {
  return {
    border: "1px solid #dbeafe",
    borderRadius: 18,
    padding: "14px 12px",
    background: disabled ? "#f1f5f9" : "linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)",
    color: "#0f172a",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    minWidth: 0,
    textAlign: "left",
    boxShadow: disabled ? "none" : "0 10px 22px rgba(37, 99, 235, 0.08)",
  };
}

function calculateOffer(basePrice: number, multiplier: number) {
  return Number((basePrice * multiplier).toFixed(8));
}

export default function DriverOpenOfferRequestsCard({
  driver,
  onOfferSubmitted,
}: {
  driver: DemoDriverRow;
  onOfferSubmitted?: () => void;
}) {
  const [requests, setRequests] = useState<RideRow[]>([]);
  const [customOfferPrices, setCustomOfferPrices] = useState<Record<string, string>>({});
  const [etaMinutes, setEtaMinutes] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [actionRideId, setActionRideId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [driverReady, setDriverReady] = useState(driver.is_online && driver.is_available);

  async function loadRequests() {
    setLoading(true);
    setError("");

    try {
      await ensureDemoDriverReadyForOffers(driver.id);
      setDriverReady(true);

      const rows = await listOpenRideOfferRequestsForDriver(driver.id);
      setRequests(rows);

      setCustomOfferPrices((current) => {
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

  async function submitOffer(ride: RideRow, offerPricePi: number) {
    const suggestedFare = Number(ride.price_pi ?? 0);

    if (ride.offer_expires_at) {
      const expiresAt = Date.parse(ride.offer_expires_at);

      if (Number.isFinite(expiresAt) && expiresAt <= Date.now() + 1500) {
        setError("This request has just expired. Ask the rider to resend the request.");
        await loadRequests();
        return;
      }
    }

    if (!Number.isFinite(offerPricePi) || offerPricePi <= 0) {
      setError("Enter a valid offer amount.");
      return;
    }

    if (offerPricePi < suggestedFare) {
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
      await ensureDemoDriverReadyForOffers(driver.id);
      setDriverReady(true);

      await submitDemoDriverRideOffer({
        rideId: ride.id,
        driverId: driver.id,
        offerPricePi,
        etaMinutes: parsedEta,
        driverNote: notes[ride.id] || null,
      });

      setMessage(`Offer submitted to rider: ${formatPiAmount(offerPricePi)}`);
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
        Available rider requests are shown here in the TrueGo offer flow.
        Use quick buttons instead of typing small Pi fractions manually.
      </p>

      {!driverReady ? (
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
        const disabled = actionLoading || !driverReady;

        return (
          <div key={ride.id} style={requestCardStyle()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: "1 1 240px" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 999,
                    padding: "6px 10px",
                    background: "#eef2ff",
                    color: "#3730a3",
                    fontWeight: 900,
                    fontSize: 12,
                    marginBottom: 10,
                  }}
                >
                  New rider request
                </div>

                <div style={{ display: "grid", gap: 8, color: "#334155" }}>
                  <div>
                    <strong style={{ color: "#0f172a" }}>Pickup</strong>
                    <div style={{ marginTop: 3, lineHeight: 1.45 }}>
                      {ride.pickup_text}
                    </div>
                  </div>

                  <div>
                    <strong style={{ color: "#0f172a" }}>Destination</strong>
                    <div style={{ marginTop: 3, lineHeight: 1.45 }}>
                      {ride.destination_text}
                    </div>
                  </div>
                </div>
              </div>

              <span
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "#7c3aed",
                  color: "#ffffff",
                  fontWeight: 900,
                  fontSize: 12,
                  boxShadow: "0 10px 20px rgba(124, 58, 237, 0.22)",
                }}
              >
                Open for offers
              </span>
            </div>

            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
                gap: 10,
              }}
            >
              <div
                style={{
                  padding: 12,
                  borderRadius: 16,
                  background: "#ecfdf5",
                  border: "1px solid #bbf7d0",
                }}
              >
                <strong style={{ color: "#065f46" }}>Suggested fare</strong>
                <div style={{ marginTop: 6, fontWeight: 900, color: "#064e3b" }}>
                  {formatPiAmount(suggestedFare)}
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 16,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <strong>Distance / time</strong>
                <div style={{ marginTop: 6, color: "#475569" }}>
                  {ride.distance_km.toFixed(2)} km · {ride.duration_min} min
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 16,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <strong>Vehicle type</strong>
                <div style={{ marginTop: 6, color: "#475569" }}>
                  {ride.vehicle_type}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 14,
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
              }}
            >
              <strong>Quick offer buttons</strong>
              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: 10,
                }}
              >
                {QUICK_INCREASES.map((option) => {
                  const offerPrice = calculateOffer(
                    suggestedFare,
                    option.multiplier
                  );

                  return (
                    <button
                      key={option.label}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        void submitOffer(ride, offerPrice);
                      }}
                      style={quickButtonStyle(disabled)}
                    >
                      <div>{option.label}</div>
                      <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
                        {formatPiAmount(offerPrice)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

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

            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 800 }}>
                Advanced custom Pi offer
              </summary>

              <label style={{ display: "block", marginTop: 12, fontWeight: 800 }}>
                Custom offer amount Pi
              </label>
              <input
                value={customOfferPrices[ride.id] ?? ""}
                onChange={(event) =>
                  setCustomOfferPrices((current) => ({
                    ...current,
                    [ride.id]: event.target.value,
                  }))
                }
                inputMode="decimal"
                style={inputStyle()}
              />

              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    void submitOffer(
                      ride,
                      Number(customOfferPrices[ride.id] ?? 0)
                    );
                  }}
                  style={buttonStyle("#111827", disabled)}
                >
                  Submit custom offer
                </button>
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}
