import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PiSessionBanner from "../../components/PiSessionBanner";
import { getStoredPiSession } from "../../lib/pi";
import MapLocationPicker from "../../components/MapLocationPicker";
import AppSideDrawer from "../../components/common/AppSideDrawer";
import RiderRideHistoryCard from "./RiderRideHistoryCard";
import RiderSafetyCard from "./RiderSafetyCard";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(14,165,233,0.16), transparent 34%), linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)",
  padding: 20,
};

const cardStyle: React.CSSProperties = {
  maxWidth: 920,
  margin: "32px auto",
  background: "rgba(255,255,255,0.96)",
  borderRadius: 28,
  padding: 24,
  boxShadow: "0 22px 65px rgba(15, 23, 42, 0.14)",
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

type RouteSuggestion = {
  label: string;
  pickup: string;
  destination: string;
};

const RECENT_ROUTE_LIMIT = 3;

function cleanPlace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildRouteLabel(pickup: string, destination: string) {
  return `${pickup} → ${destination}`;
}

function getRouteFingerprint(pickup: string, destination: string) {
  return `${pickup.toLowerCase()}__${destination.toLowerCase()}`;
}

function getRecentRoutesStorageKey() {
  const session = getStoredPiSession();
  return session?.uid ? `truego_recent_routes:${session.uid}` : "truego_recent_routes:guest";
}

function readRecentRoutes(): RouteSuggestion[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getRecentRoutesStorageKey());
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((route) => {
        const pickup = cleanPlace(String(route?.pickup ?? ""));
        const destination = cleanPlace(String(route?.destination ?? ""));

        if (!pickup || !destination) {
          return null;
        }

        return {
          label: buildRouteLabel(pickup, destination),
          pickup,
          destination,
        };
      })
      .filter(Boolean)
      .slice(0, RECENT_ROUTE_LIMIT) as RouteSuggestion[];
  } catch {
    return [];
  }
}

function saveRecentRoute(pickup: string, destination: string) {
  const cleanPickup = cleanPlace(pickup);
  const cleanDestination = cleanPlace(destination);

  if (!cleanPickup || !cleanDestination) {
    return readRecentRoutes();
  }

  const current = readRecentRoutes();
  const fingerprint = getRouteFingerprint(cleanPickup, cleanDestination);

  const nextRoutes = [
    {
      label: buildRouteLabel(cleanPickup, cleanDestination),
      pickup: cleanPickup,
      destination: cleanDestination,
    },
    ...current.filter(
      (route) => getRouteFingerprint(route.pickup, route.destination) !== fingerprint
    ),
  ].slice(0, RECENT_ROUTE_LIMIT);

  try {
    window.localStorage.setItem(getRecentRoutesStorageKey(), JSON.stringify(nextRoutes));
  } catch {
    // Keep ride booking usable even if local storage is unavailable.
  }

  return nextRoutes;
}

export default function RiderHome() {
  const [riderDrawerFocus, setRiderDrawerFocus] = useState<"history" | null>(null);

  function openRiderHistoryFromDrawer() {
    setRiderDrawerFocus("history");

    window.setTimeout(() => {
      document.getElementById("rider-history-focus")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 250);
  }

  const navigate = useNavigate();
const [pickup, setPickup] = useState("");
const [destination, setDestination] = useState("");
const [recentRoutes, setRecentRoutes] = useState<RouteSuggestion[]>(() => readRecentRoutes());
const hasRecentRoutes = recentRoutes.length > 0;

function handleFindRide() {
  const cleanPickup = cleanPlace(pickup);
  const cleanDestination = cleanPlace(destination);

  if (!cleanPickup || !cleanDestination) {
    window.alert("Please enter pickup and destination.");
    return;
  }

  setPickup(cleanPickup);
  setDestination(cleanDestination);
  setRecentRoutes(saveRecentRoute(cleanPickup, cleanDestination));

  const params = new URLSearchParams({
    pickup: cleanPickup,
    destination: cleanDestination,
  });

  navigate(`/rider/ride?${params.toString()}`);
}

  function applyRouteSuggestion(route: RouteSuggestion) {
    setPickup(route.pickup);
    setDestination(route.destination);
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
            <AppSideDrawer
        title="TrueGo Rider"
        subtitle="Pi rider account"
        appLabel="Rider"
        avatarText="RI"
        items={[
          { label: "Request ride", icon: "🚕", href: "#request-ride" },
          { label: "Ride history", icon: "🕘", href: "#rider-history-focus", onSelect: openRiderHistoryFromDrawer },
          { label: "Safety", icon: "🛡️", href: "#rider-safety" },
          { label: "Support", icon: "💬", href: "https://t.me/truego_community", external: true },
          { label: "Official Channel", icon: "📢", href: "https://t.me/truego_official", external: true },
        ]}
      />
<PiSessionBanner appLabel="TrueGo Rider" />

      {riderDrawerFocus === "history" ? (
        <div id="rider-history-focus">
          <div id="rider-history"><RiderRideHistoryCard /></div>
      <RiderSafetyCard />
        </div>
      ) : null}

        <div id="request-ride" style={badgeStyle}>TrueGo Rider</div>

        <h1 style={titleStyle}>Book your ride with TrueGo</h1>

        <p style={subtitleStyle}>
          Request a ride, compare driver offers, track the trip, and pay securely with Pi after completion.
        </p>

        <div style={stepGridStyle}>
          <div style={stepStyle}>
            <strong>1. Enter trip</strong>
            <br />
            Add pickup and destination.
          </div>
          <div style={stepStyle}>
            <strong>2. Compare offers</strong>
            <br />
            Review fare, distance, time, and incoming driver offers.
          </div>
          <div style={stepStyle}>
            <strong>3. Choose driver</strong>
            <br />
            Accept the offer that best matches your trip.
          </div>
          <div style={stepStyle}>
            <strong>4. Pay after trip</strong>
            <br />
            Pay securely after the ride is completed.
          </div>
        </div>

        <div style={fieldGroupStyle}>
<label style={labelStyle}>Recent route suggestions</label>
<div style={quickGridStyle}>
  {hasRecentRoutes ? (
    recentRoutes.map((route) => (
      <button
        key={`${route.pickup}-${route.destination}`}
        type="button"
        onClick={() => applyRouteSuggestion(route)}
        style={quickButtonStyle}
      >
        {route.label}
      </button>
    ))
  ) : (
    <div
      style={{
        gridColumn: "1 / -1",
        padding: "12px 14px",
        borderRadius: 12,
        background: "#f8fafc",
        border: "1px dashed #cbd5e1",
        color: "#64748b",
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      Your last 3 routes will appear here after you request rides from this Pi account.
    </div>
  )}
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
            placeholder="Example: Current location, station, hotel, or 30.0444,31.2357"
            value={pickup}
            onChange={(event) => setPickup(event.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle} htmlFor="destination">
            Destination
          </label>
          <input
            id="destination"
            placeholder="Example: Destination name, landmark, or direct coordinates"
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            style={inputStyle}
          />

          <button type="button" onClick={handleFindRide} style={buttonStyle}>
            Continue
          </button>

          <p style={helperStyle}>
            Type a place name, paste coordinates, or choose locations from the map.
          </p>
        </div>

        <div style={featureGridStyle}>
          <div style={featureStyle}>
            <strong>Rider-first flow:</strong> request, compare, track, and pay from one
            clear mobile-friendly path.
          </div>
          <div style={featureStyle}>
            <strong>Pi payment:</strong> secure Pi payments
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
