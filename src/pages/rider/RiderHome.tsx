import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ListingReadinessPanel from "../../components/ListingReadinessPanel";
import PiSessionBanner from "../../components/PiSessionBanner";
import MapLocationPicker from "../../components/MapLocationPicker";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)",
  padding: 20,
};

const cardStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "32px auto",
  background: "#ffffff",
  borderRadius: 24,
  padding: 22,
  boxShadow: "0 18px 55px rgba(15, 23, 42, 0.12)",
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
  fontWeight: 800,
  marginBottom: 14,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 32,
  lineHeight: 1.12,
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 10,
  color: "#475569",
  fontSize: 15,
  lineHeight: 1.7,
};

const fieldGroupStyle: React.CSSProperties = {
  marginTop: 18,
  padding: 16,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 800,
  color: "#334155",
  marginBottom: 7,
};

const inputStyle: React.CSSProperties = {
  padding: "14px 14px",
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
  padding: 15,
  width: "100%",
  background: "#0ea5e9",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(14, 165, 233, 0.22)",
};

const helperStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  marginTop: 12,
  lineHeight: 1.6,
};

const featureGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 10,
  marginTop: 18,
};

const featureStyle: React.CSSProperties = {
  padding: 13,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.5,
};

const quickGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 8,
  marginTop: 10,
  marginBottom: 12,
};

const quickButtonStyle: React.CSSProperties = {
  border: "1px solid #bae6fd",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#f0f9ff",
  color: "#0369a1",
  fontWeight: 800,
  cursor: "pointer",
};

const stepGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
  marginTop: 18,
};

const stepStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 16,
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  color: "#065f46",
  fontSize: 13,
  lineHeight: 1.5,
};

type DemoRoute = {
  label: string;
  pickup: string;
  destination: string;
};

const demoRoutes: DemoRoute[] = [
  { label: "Giza → Cairo", pickup: "Giza", destination: "Cairo" },
  { label: "Cairo → Giza", pickup: "Cairo", destination: "Giza" },
  { label: "Airport → City", pickup: "Cairo Airport", destination: "Cairo City Center" },
];

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

  function applyDemoRoute(route: DemoRoute) {
    setPickup(route.pickup);
    setDestination(route.destination);
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <ListingReadinessPanel context="rider" compact />

      <PiSessionBanner appLabel="TrueGo Rider" />

        <div style={badgeStyle}>Pi-powered mobility</div>

        <h1 style={titleStyle}>Request a ride with TrueGo</h1>

        <p style={subtitleStyle}>
          TrueGo helps Pi users request rides, review a transparent Test-Pi fare,
          connect with available drivers, and complete the trip through a simple
          Pi Browser experience.
        </p>

        <div style={stepGridStyle}>
          <div style={stepStyle}>
            <strong>1. Enter trip</strong>
            <br />
            Add pickup and destination.
          </div>
          <div style={stepStyle}>
            <strong>2. Review fare</strong>
            <br />
            See distance, time, and fractional Test-Pi price.
          </div>
          <div style={stepStyle}>
            <strong>3. Driver accepts</strong>
            <br />
            The ride is assigned only after driver acceptance.
          </div>
          <div style={stepStyle}>
            <strong>4. Pay with Pi</strong>
            <br />
            Complete payment after trip completion.
          </div>
        </div>

        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Quick demo routes</label>
          <div style={quickGridStyle}>
            {demoRoutes.map((route) => (
              <button
                key={route.label}
                type="button"
                onClick={() => applyDemoRoute(route)}
                style={quickButtonStyle}
              >
                {route.label}
              </button>
            ))}
          </div>

          <MapLocationPicker
            pickupText={pickup}
            destinationText={destination}
            onPickupChange={setPickup}
            onDestinationChange={setDestination}
          />

          <label style={labelStyle} htmlFor="pickup">
            Pickup location
          </label>
          <input
            id="pickup"
            placeholder="Example: Giza or 30.0444,31.2357"
            value={pickup}
            onChange={(event) => setPickup(event.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle} htmlFor="destination">
            Destination
          </label>
          <input
            id="destination"
            placeholder="Example: Cairo or direct coordinates"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            style={inputStyle}
          />

          <button type="button" onClick={handleFindRide} style={buttonStyle}>
            Continue to fare estimate
          </button>

          <p style={helperStyle}>
            You can type place names, paste coordinates, or click on the map to
            choose pickup and destination. The next step shows the route, fare,
            vehicle type, and driver matching status.
          </p>
        </div>

        <div style={featureGridStyle}>
          <div style={featureStyle}>
            <strong>Rider-first flow:</strong> request and track rides from one
            clear mobile-friendly path.
          </div>
          <div style={featureStyle}>
            <strong>Pi Testnet ready:</strong> small fractional Test-Pi amounts
            keep repeated review payments safe.
          </div>
          <div style={featureStyle}>
            <strong>Offer-based dispatch:</strong> drivers accept the ride before
            assignment.
          </div>
          <div style={featureStyle}>
            <strong>Free maps:</strong> location picking and route previews use
            OpenStreetMap, Leaflet, and OSRM.
          </div>
        </div>
      </section>
    </main>
  );
}
