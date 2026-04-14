import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { VehicleType } from "../../types/ride";
import {
  calculateRouteEstimateByText,
  type RouteEstimate,
} from "../../services/rideService";
import { createRideAndAutoDispatch } from "../../services/rideApi";

function containerStyle(): React.CSSProperties {
  return {
    maxWidth: 620,
    margin: "40px auto",
    background: "#ffffff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    padding: 12,
    width: "100%",
    marginBottom: 12,
    borderRadius: 10,
    border: "1px solid #d1d5db",
  };
}

function vehicleButtonStyle(
  isActive: boolean,
  background: string
): React.CSSProperties {
  return {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    border: isActive ? "1px solid transparent" : "1px solid #d1d5db",
    background: isActive ? background : "#ffffff",
    color: isActive ? "#ffffff" : "#111827",
    fontWeight: 600,
  };
}

function infoCardStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  };
}

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

  async function handleEstimate() {
    if (!pickupText.trim() || !destinationText.trim()) {
      setErrorMessage("Please enter pickup and destination.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const result = await calculateRouteEstimateByText(
        pickupText,
        destinationText,
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

    setSubmitting(true);
    setErrorMessage("");

    try {
      const ride = await createRideAndAutoDispatch({
        rider_user_id: null,
        rider_name: "Demo Rider",
        pickup_text: pickupText,
        destination_text: destinationText,
        pickup_lat: estimate.pickup.lat,
        pickup_lng: estimate.pickup.lng,
        destination_lat: estimate.destination.lat,
        destination_lng: estimate.destination.lng,
        distance_km: estimate.distanceKm,
        duration_min: estimate.durationMin,
        price_pi: estimate.pricePi,
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
    <div style={{ padding: 20 }}>
      <div style={containerStyle()}>
        <h2 style={{ marginTop: 0 }}>Request Ride</h2>

        <input
          placeholder="Pickup location"
          value={pickupText}
          onChange={(event) => setPickupText(event.target.value)}
          style={inputStyle()}
        />

        <input
          placeholder="Destination"
          value={destinationText}
          onChange={(event) => setDestinationText(event.target.value)}
          style={inputStyle()}
        />

        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <button
            onClick={() => setVehicleType("car")}
            style={vehicleButtonStyle(vehicleType === "car", "#0ea5e9")}
          >
            Car
          </button>

          <button
            onClick={() => setVehicleType("motorcycle")}
            style={vehicleButtonStyle(vehicleType === "motorcycle", "#10b981")}
          >
            Motorcycle
          </button>
        </div>

        <button
          onClick={handleEstimate}
          disabled={loading || submitting}
          style={{
            width: "100%",
            padding: 12,
            border: "none",
            borderRadius: 10,
            background: "#111827",
            color: "#ffffff",
            fontWeight: 600,
          }}
        >
          {loading ? "Calculating..." : "Estimate Ride"}
        </button>

        {errorMessage ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        {estimate ? (
          <div style={infoCardStyle()}>
            <div style={{ marginBottom: 8 }}>
              <strong>Distance:</strong> {estimate.distanceKm} km
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>Time:</strong> {estimate.durationMin} min
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>Price:</strong> {estimate.pricePi} Pi
            </div>

            <button
              onClick={handleRequestRide}
              disabled={submitting}
              style={{
                width: "100%",
                padding: 12,
                border: "none",
                borderRadius: 10,
                background: "#0ea5e9",
                color: "#ffffff",
                fontWeight: 600,
              }}
            >
              {submitting ? "Creating Ride..." : "Confirm Request"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}