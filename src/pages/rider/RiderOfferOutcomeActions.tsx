import { useEffect, useMemo, useState } from "react";

import {
  cancelRideRequest,
  resendRideDriverOfferRequest,
  type RideRow,
} from "../../services/rideApi";

type RiderOfferOutcomeActionsProps = {
  ride: RideRow;
  onRideUpdated: (ride: RideRow) => void;
};

function formatPiAmount(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.00000000 π";
  }

  return `${value.toFixed(8)} π`;
}

function clampFare(value: number): number {
  return Math.max(0.00000001, Number(value.toFixed(8)));
}

function getFareStep(baseFare: number): number {
  const fivePercent = baseFare * 0.05;
  return clampFare(Math.max(fivePercent, 0.00000001));
}

export default function RiderOfferOutcomeActions({
  ride,
  onRideUpdated,
}: RiderOfferOutcomeActionsProps) {
  const originalFare = useMemo(() => {
    return clampFare(Number(ride.price_pi ?? 0));
  }, [ride.price_pi]);

  const [fare, setFare] = useState(originalFare);
  const [loadingAction, setLoadingAction] = useState<"send" | "cancel" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isNoDriverAvailable = ride.status === "no_driver_available";
  const isOffersExpired = ride.status === "offers_expired";
  const fareStep = getFareStep(originalFare);

  useEffect(() => {
    setFare(originalFare);
    setMessage("");
    setError("");
  }, [originalFare, ride.status]);

  if (!isNoDriverAvailable && !isOffersExpired) {
    return null;
  }

  async function handleSendAgain() {
    setLoadingAction("send");
    setError("");
    setMessage("");

    try {
      const updatedRide = await resendRideDriverOfferRequest({
        rideId: ride.id,
        newPricePi: isNoDriverAvailable ? fare : originalFare,
        offerWindowSeconds: 60,
      });

      onRideUpdated(updatedRide);
      setMessage("Ride request sent again. Waiting for driver offers.");
    } catch (err) {
      const fallback = "Failed to send the request again.";
      setError(err instanceof Error ? err.message : fallback);
      console.error("Resend ride offer request failed:", err);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleCancel() {
    setLoadingAction("cancel");
    setError("");
    setMessage("");

    try {
      const updatedRide = await cancelRideRequest(ride.id);
      onRideUpdated(updatedRide);
      setMessage("Ride request cancelled.");
    } catch (err) {
      const fallback = "Failed to cancel the ride request.";
      setError(err instanceof Error ? err.message : fallback);
      console.error("Cancel ride request failed:", err);
    } finally {
      setLoadingAction(null);
    }
  }

  const disabled = loadingAction !== null;

  return (
    <section
      style={{
        marginTop: 16,
        padding: 18,
        borderRadius: 18,
        background: isNoDriverAvailable ? "#fff7ed" : "#eef2ff",
        border: isNoDriverAvailable ? "1px solid #fed7aa" : "1px solid #c7d2fe",
        color: "#0f172a",
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <strong style={{ fontSize: 17 }}>
          {isNoDriverAvailable
            ? "No driver accepted your fare"
            : "Driver offers expired"}
        </strong>

        <span style={{ color: "#475569", lineHeight: 1.6 }}>
          {isNoDriverAvailable
            ? "No driver responded to the initial fare. Increase the fare and send the request again."
            : "You received driver offers, but no offer was selected before the window expired. Send the request again or cancel."}
        </span>
      </div>

      {isNoDriverAvailable ? (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setFare((current) => clampFare(current - fareStep))}
            disabled={disabled}
            style={smallButtonStyle(disabled)}
          >
            -
          </button>

          <div
            style={{
              minWidth: 180,
              textAlign: "center",
              padding: "10px 14px",
              borderRadius: 14,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              fontWeight: 800,
            }}
          >
            {formatPiAmount(fare)}
          </div>

          <button
            type="button"
            onClick={() => setFare((current) => clampFare(current + fareStep))}
            disabled={disabled}
            style={smallButtonStyle(disabled)}
          >
            +
          </button>
        </div>
      ) : null}

      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => {
            void handleSendAgain();
          }}
          disabled={disabled}
          style={primaryButtonStyle("#111827", disabled)}
        >
          {loadingAction === "send" ? "Sending..." : "Send request again"}
        </button>

        <button
          type="button"
          onClick={() => {
            void handleCancel();
          }}
          disabled={disabled}
          style={primaryButtonStyle("#b91c1c", disabled)}
        >
          {loadingAction === "cancel" ? "Cancelling..." : "Cancel"}
        </button>
      </div>

      {message ? (
        <p style={{ marginTop: 12, color: "#166534", fontWeight: 700 }}>{message}</p>
      ) : null}

      {error ? (
        <p style={{ marginTop: 12, color: "#b91c1c", fontWeight: 700 }}>{error}</p>
      ) : null}
    </section>
  );
}

function smallButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 44,
    height: 44,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: disabled ? "#e5e7eb" : "#ffffff",
    color: "#0f172a",
    fontSize: 24,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function primaryButtonStyle(color: string, disabled: boolean): React.CSSProperties {
  return {
    border: "none",
    borderRadius: 14,
    padding: "12px 16px",
    background: disabled ? "#94a3b8" : color,
    color: "#ffffff",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
