import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

type PickMode = "pickup" | "destination";

type MapLocationPickerProps = {
  pickupText: string;
  destinationText: string;
  onPickupChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
};

function parseCoordinates(value: string) {
  const parts = value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part));

  if (parts.length !== 2) {
    return null;
  }

  const [lat, lng] = parts;

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  return { lat, lng };
}

function formatCoordinates(lat: number, lng: number) {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function markerIcon(label: string, background: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 30px;
        height: 30px;
        border-radius: 999px;
        background: ${background};
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        border: 3px solid white;
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.25);
      ">
        ${label}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function pickerButtonStyle(active: boolean): React.CSSProperties {
  return {
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "9px 12px",
    background: active ? "#111827" : "#ffffff",
    color: active ? "#ffffff" : "#111827",
    fontWeight: 800,
    cursor: "pointer",
  };
}

export default function MapLocationPicker({
  pickupText,
  destinationText,
  onPickupChange,
  onDestinationChange,
}: MapLocationPickerProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  const [pickMode, setPickMode] = useState<PickMode>("pickup");

  const pickupPoint = useMemo(() => parseCoordinates(pickupText), [pickupText]);
  const destinationPoint = useMemo(
    () => parseCoordinates(destinationText),
    [destinationText]
  );

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapNodeRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    }).setView([30.0444, 31.2357], 11);

    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (event: L.LeafletMouseEvent) => {
      const value = formatCoordinates(event.latlng.lat, event.latlng.lng);

      if (pickMode === "pickup") {
        onPickupChange(value);
        setPickMode("destination");
      } else {
        onDestinationChange(value);
      }
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onDestinationChange, onPickupChange, pickMode]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
      pickupMarkerRef.current = null;
    }

    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
    }

    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    const routePoints: L.LatLng[] = [];

    if (pickupPoint) {
      const pickupLatLng = L.latLng(pickupPoint.lat, pickupPoint.lng);
      routePoints.push(pickupLatLng);

      pickupMarkerRef.current = L.marker(pickupLatLng, {
        icon: markerIcon("P", "#0ea5e9"),
      })
        .addTo(map)
        .bindPopup("Pickup");
    }

    if (destinationPoint) {
      const destinationLatLng = L.latLng(
        destinationPoint.lat,
        destinationPoint.lng
      );
      routePoints.push(destinationLatLng);

      destinationMarkerRef.current = L.marker(destinationLatLng, {
        icon: markerIcon("D", "#16a34a"),
      })
        .addTo(map)
        .bindPopup("Destination");
    }

    if (routePoints.length === 2) {
      routeLineRef.current = L.polyline(routePoints, {
        color: "#111827",
        weight: 4,
        opacity: 0.75,
        dashArray: "8 8",
      }).addTo(map);

      map.fitBounds(L.latLngBounds(routePoints).pad(0.35));
    } else if (routePoints.length === 1) {
      map.setView(routePoints[0], 13);
    }
  }, [destinationPoint, pickupPoint]);

  return (
    <div
      style={{
        marginTop: 14,
        marginBottom: 14,
        padding: 12,
        borderRadius: 16,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <div>
          <strong>Pick locations on map</strong>
          <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
            Click the map to set pickup first, then destination. Coordinates are
            copied into the current fields.
          </div>
        </div>

        <span
          style={{
            borderRadius: 999,
            padding: "6px 10px",
            background: "#ecfdf5",
            color: "#047857",
            fontWeight: 800,
            fontSize: 12,
          }}
        >
          Free OSM picker
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => setPickMode("pickup")}
          style={pickerButtonStyle(pickMode === "pickup")}
        >
          Pick Pickup
        </button>

        <button
          type="button"
          onClick={() => setPickMode("destination")}
          style={pickerButtonStyle(pickMode === "destination")}
        >
          Pick Destination
        </button>
      </div>

      <div
        ref={mapNodeRef}
        style={{
          height: 300,
          width: "100%",
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid #cbd5e1",
        }}
      />

      <div
        style={{
          marginTop: 10,
          padding: 10,
          borderRadius: 12,
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          color: "#334155",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <strong>Current mode:</strong>{" "}
        {pickMode === "pickup" ? "Pick Pickup" : "Pick Destination"}
      </div>
    </div>
  );
}
