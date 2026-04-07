import { useState } from "react";
import { useNavigate } from "react-router-dom";

function cardStyle(): React.CSSProperties {
  return {
    maxWidth: 520,
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

export default function RiderHome() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");

  function handleFindRide() {
    if (!pickup.trim() || !destination.trim()) {
      window.alert("Please enter pickup and destination.");
      return;
    }

    const params = new URLSearchParams({
      pickup,
      destination,
    });

    navigate(`/rider/ride?${params.toString()}`);
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>TrueGo Rider</h2>

        <div style={{ marginTop: 20 }}>
          <input
            placeholder="Pickup location"
            value={pickup}
            onChange={(event) => setPickup(event.target.value)}
            style={inputStyle()}
          />

          <input
            placeholder="Where to?"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            style={inputStyle()}
          />

          <button
            onClick={handleFindRide}
            style={{
              padding: 12,
              width: "100%",
              background: "#0ea5e9",
              color: "white",
              border: "none",
              borderRadius: 8,
            }}
          >
            Find Ride
          </button>

          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 12 }}>
            You can enter normal place names, or direct coordinates like:
            30.0444,31.2357
          </p>
        </div>
      </div>
    </div>
  );
}