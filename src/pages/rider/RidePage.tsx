import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { VehicleType } from "../../types/ride";
import {
  calculateRouteEstimateByText,
  type RouteEstimate,
} from "../../services/rideService";
import { createRideAndCollectDriverOffers } from "../../services/rideApi";
import { formatPiAmount } from "../../lib/piPricing";
import { getStoredPiSession } from "../../lib/pi";
import RideMapPreview from "../../components/RideMapPreview";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top left, rgba(14,165,233,0.14), transparent 34%), linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)",
  padding: 20,
};

const containerStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "32px auto",
  background: "rgba(255,255,255,0.96)",
  borderRadius: 28,
  padding: 24,
  boxShadow: "0 22px 65px rgba(15, 23, 42, 0.14)",
  border: "1px solid #e5e7eb",
};

const eyebrowStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "7px 10px",
  borderRadius: 999,
  background: "#e0f2fe",
  color: "#0369a1",
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 12,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 28,
  lineHeight: 1.2,
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 10,
  marginBottom: 20,
  color: "#475569",
  fontSize: 15,
  lineHeight: 1.6,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 800,
  color: "#334155",
  marginBottom: 7,
};

const inputStyle: React.CSSProperties = {
  padding: "13px 14px",
  width: "100%",
  marginBottom: 14,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  outline: "none",
  fontSize: 15,
  boxSizing: "border-box",
  background: "#ffffff",
};

function vehicleButtonStyle(
  isActive: boolean,
  background: string
): React.CSSProperties {
  return {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    border: isActive ? "1px solid transparent" : "1px solid #cbd5e1",
    background: isActive ? background : "#ffffff",
    color: isActive ? "#ffffff" : "#111827",
    fontWeight: 800,
    cursor: "pointer",
  };
}

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: 14,
  border: "none",
  borderRadius: 12,
  background: "#0ea5e9",
  color: "#ffffff",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(14, 165, 233, 0.22)",
};

const darkButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: "#111827",
  boxShadow: "0 10px 20px rgba(17, 24, 39, 0.16)",
};

const errorStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "#fef2f2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
  fontSize: 14,
  lineHeight: 1.5,
};

const infoCardStyle: React.CSSProperties = {
  marginTop: 18,
  padding: 16,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
  marginBottom: 16,
};

const summaryItemStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
};

const summaryLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const summaryValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
  marginTop: 4,
};

const helperStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.55,
  marginTop: 12,
};

export default function RidePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [pickupText, setPickupText] = useState(searchParams.get("pickup") ?? "");
  const [destinationText, setDestinationText] = useState(
    searchParams.get("destination") ?? ""
  );
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [estimate, setEstimate] = useState<RouteEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const payableEstimatePi = estimate ? estimate.pricePi : 0;

  async function handleEstimate() {
    if (!pickupText.trim() || !destinationText.trim()) {
      setErrorMessage("Please enter pickup and destination.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const result = await calculateRouteEstimateByText(
        pickupText.trim(),
        destinationText.trim(),
        vehicleType
      );

      setEstimate(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to estimate route.";

      setErrorMessage(message);
      setEstimate(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestRide() {
    if (!estimate) {
      setErrorMessage("Please estimate the route first.");
      return;
    }

    const session = getStoredPiSession();

    setSubmitting(true);
    setErrorMessage("");

    try {
      const ride = await createRideAndCollectDriverOffers({
        rider_user_id: null,
        rider_name: session?.username ? `@${session.username}` : "Pi Rider",
        pickup_text: pickupText.trim(),
        destination_text: destinationText.trim(),
        pickup_lat: estimate.pickup.lat,
        pickup_lng: estimate.pickup.lng,
        destination_lat: estimate.destination.lat,
        destination_lng: estimate.destination.lng,
        distance_km: estimate.distanceKm,
        duration_min: estimate.durationMin,
        price_pi: payableEstimatePi,
        route_source: estimate.routeSource,
        vehicle_type: vehicleType,
        status: "searching",
      });

      navigate(`/rider/status/${ride.id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create ride.";

      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={pageStyle}>
      <section style={containerStyle}>

        <div style={eyebrowStyle}>Trip details</div>

        <h1 style={titleStyle}>Confirm your ride request</h1>

        <p style={subtitleStyle}>
          Confirm your pickup, destination, vehicle type, and suggested fare before sending the request to available drivers.
        </p>

        <label style={labelStyle} htmlFor="pickup">
          Pickup location
        </label>
        <input
          id="pickup"
          placeholder="Pickup location"
          value={pickupText}
          onChange={(event) => setPickupText(event.target.value)}
          style={inputStyle}
        />

        <label style={labelStyle} htmlFor="destination">
          Destination
        </label>
        <input
          id="destination"
          placeholder="Destination"
          value={destinationText}
          onChange={(event) => setDestinationText(event.target.value)}
          style={inputStyle}
        />

        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setVehicleType("car")}
            style={vehicleButtonStyle(vehicleType === "car", "#0ea5e9")}
          >
            Car
          </button>

          <button
            type="button"
            onClick={() => setVehicleType("motorcycle")}
            style={vehicleButtonStyle(vehicleType === "motorcycle", "#10b981")}
          >
            Motorcycle
          </button>
        </div>

        <button
          type="button"
          onClick={handleEstimate}
          disabled={loading || submitting}
          style={{
            ...darkButtonStyle,
            opacity: loading || submitting ? 0.7 : 1,
            cursor: loading || submitting ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Calculating estimate..." : "Calculate fare"}
        </button>

        <p style={helperStyle}>
          Your request will be sent to available drivers. You choose the driver offer before the trip is assigned.
        </p>

        {errorMessage ? <div style={errorStyle}>{errorMessage}</div> : null}

        {estimate ? (
          <div style={infoCardStyle}>
            <div style={summaryGridStyle}>
              <div style={summaryItemStyle}>
                <div style={summaryLabelStyle}>Distance</div>
                <div style={summaryValueStyle}>{estimate.distanceKm} km</div>
              </div>

              <div style={summaryItemStyle}>
                <div style={summaryLabelStyle}>Estimated time</div>
                <div style={summaryValueStyle}>{estimate.durationMin} min</div>
              </div>

              <div style={summaryItemStyle}>
                <div style={summaryLabelStyle}>Estimated price</div>
                <div style={summaryValueStyle}>{formatPiAmount(payableEstimatePi)}</div>
              </div>

              <div style={summaryItemStyle}>
                <div style={summaryLabelStyle}>Route source</div>
                <div style={summaryValueStyle}>
                  {estimate.routeSource === "osrm" ? "OSRM road route" : "Fallback estimate"}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                marginBottom: 14,
                padding: 12,
                borderRadius: 14,
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                color: "#0369a1",
                lineHeight: 1.6,
                fontSize: 14,
              }}
            >
              <strong>Route source note:</strong>{" "}
              {estimate.routeSource === "osrm"
                ? "Distance and time are based on an OSRM road route."
                : "OSRM was unavailable, so TrueGo used a safe fallback estimate."}
            </div>

            <div
              style={{
                marginTop: 14,
                marginBottom: 14,
                padding: 12,
                borderRadius: 14,
                background: "#ecfdf5",
                border: "1px solid #bbf7d0",
                color: "#047857",
                lineHeight: 1.6,
                fontSize: 14,
              }}
            >
              <strong>Driver dispatch note:</strong> after confirmation, TrueGo
              sends an offer to an available driver. The ride becomes assigned
              only when the driver accepts.
            </div>

            <RideMapPreview
              title="Estimated route preview"
              pickup={{
                lat: estimate.pickup.lat,
                lng: estimate.pickup.lng,
                label: pickupText,
              }}
              destination={{
                lat: estimate.destination.lat,
                lng: estimate.destination.lng,
                label: destinationText,
              }}
            />

            <button
              type="button"
              onClick={handleRequestRide}
              disabled={submitting}
              style={{
                ...primaryButtonStyle,
                opacity: submitting ? 0.7 : 1,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Sending request..." : "Confirm and Find Driver"}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
