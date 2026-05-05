import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

type MapPoint = {
  lat?: number | null;
  lng?: number | null;
  label?: string | null;
};

type RideMapPreviewProps = {
  pickup: MapPoint;
  destination: MapPoint;
  title?: string;
  height?: number;
};

function isValidPoint(point: MapPoint) {
  return (
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lng)
  );
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

export default function RideMapPreview({
  pickup,
  destination,
  title = "Route map preview",
  height = 280,
}: RideMapPreviewProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const hasValidRoute = isValidPoint(pickup) && isValidPoint(destination);

  useEffect(() => {
    if (!mapNodeRef.current || !hasValidRoute) {
      return;
    }

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const pickupLatLng = L.latLng(pickup.lat as number, pickup.lng as number);
    const destinationLatLng = L.latLng(
      destination.lat as number,
      destination.lng as number
    );

    const map = L.map(mapNodeRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    });

    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    L.marker(pickupLatLng, { icon: markerIcon("P", "#0ea5e9") })
      .addTo(map)
      .bindPopup(pickup.label || "Pickup");

    L.marker(destinationLatLng, { icon: markerIcon("D", "#16a34a") })
      .addTo(map)
      .bindPopup(destination.label || "Destination");

    L.polyline([pickupLatLng, destinationLatLng], {
      color: "#111827",
      weight: 4,
      opacity: 0.75,
      dashArray: "8 8",
    }).addTo(map);

    const bounds = L.latLngBounds([pickupLatLng, destinationLatLng]);
    map.fitBounds(bounds.pad(0.35));

    setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [
    hasValidRoute,
    pickup.lat,
    pickup.lng,
    pickup.label,
    destination.lat,
    destination.lng,
    destination.label,
  ]);

  return (
    <div
      style={{
        marginTop: 16,
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
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <div>
          <strong>{title}</strong>
          <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
            Free map preview powered by OpenStreetMap.
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
          OSM / Leaflet
        </span>
      </div>

      {hasValidRoute ? (
        <div
          ref={mapNodeRef}
          style={{
            height,
            width: "100%",
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid #cbd5e1",
          }}
        />
      ) : (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            lineHeight: 1.6,
          }}
        >
          Map preview will appear after route coordinates are available.
        </div>
      )}
    </div>
  );
}
