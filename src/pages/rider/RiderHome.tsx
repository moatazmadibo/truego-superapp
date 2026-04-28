import { useState } from "react";
import { useNavigate } from "react-router-dom";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)",
  padding: 20,
};

const cardStyle: React.CSSProperties = {
  maxWidth: 560,
  margin: "32px auto",
  background: "#ffffff",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 16px 45px rgba(15, 23, 42, 0.10)",
  border: "1px solid #e5e7eb",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 10px",
  borderRadius: 999,
  background: "#e0f2fe",
  color: "#0369a1",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 14,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 30,
  lineHeight: 1.15,
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 10,
  color: "#475569",
  fontSize: 15,
  lineHeight: 1.6,
};

const fieldGroupStyle: React.CSSProperties = {
  marginTop: 16,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  color: "#334155",
  marginBottom: 7,
};

const inputStyle: React.CSSProperties = {
  padding: "13px 14px",
  width: "100%",
  marginBottom: 12,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  outline: "none",
  fontSize: 15,
  boxSizing: "border-box",
  background: "#ffffff",
};

const buttonStyle: React.CSSProperties = {
  padding: 14,
  width: "100%",
  background: "#0ea5e9",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(14, 165, 233, 0.22)",
};

const helperStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  marginTop: 12,
  lineHeight: 1.55,
};

const featureGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
  marginTop: 18,
};

const featureStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.45,
};

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
      pickup: pickup.trim(),
      destination: destination.trim(),
    });

    navigate(`/rider/ride?${params.toString()}`);
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={badgeStyle}>Pi-powered mobility</div>

        <h1 style={titleStyle}>Request a ride with TrueGo</h1>

        <p style={subtitleStyle}>
          TrueGo helps Pi users request rides, view estimated pricing, and
          connect with available drivers through a simple Pi Browser experience.
        </p>

        <div style={fieldGroupStyle}>
          <label style={labelStyle} htmlFor="pickup">
            Pickup location
          </label>
          <input
            id="pickup"
            placeholder="Example: Khartoum Airport or 30.0444,31.2357"
            value={pickup}
            onChange={(event) => setPickup(event.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle} htmlFor="destination">
            Destination
          </label>
          <input
            id="destination"
            placeholder="Example: City center or direct coordinates"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            style={inputStyle}
          />

          <button type="button" onClick={handleFindRide} style={buttonStyle}>
            Find Ride
          </button>

          <p style={helperStyle}>
            Enter normal place names or direct coordinates. The next step will
            show ride details, estimated price, and driver matching status.
          </p>
        </div>

        <div style={featureGridStyle}>
          <div style={featureStyle}>
            <strong>Rider-first flow:</strong> the main app experience is focused
            on requesting and tracking rides.
          </div>
          <div style={featureStyle}>
            <strong>Pi ecosystem:</strong> designed for Pi Browser authentication
            and future Pi-based service payments.
          </div>
          <div style={featureStyle}>
            <strong>Clear status:</strong> follow the ride from search to driver
            acceptance, arrival, progress, and completion.
          </div>
        </div>
      </section>
    </main>
  );
}
