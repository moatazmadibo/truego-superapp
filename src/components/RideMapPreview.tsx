import { useEffect, useRef, useState } from "react";
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

type OsrmRouteResponse = {
  routes?: Array<{
    geometry?: {
      coordinates?: Array<[number, number]>;
    };
    distance?: number;
    duration?: number;
  }>;
};

type RouteSource = "loading" | "osrm" | "fallback" | "unavailable";

const osrmBaseUrl =
  (import.meta.env.VITE_OSRM_BASE_URL as string | undefined) ||
  "https://router.project-osrm.org";

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

async function fetchOsrmRoute(
  pickup: Required<Pick<MapPoint, "lat" | "lng">>,
  destination: Required<Pick<MapPoint, "lat" | "lng">>,
  signal: AbortSignal
) {
  const url = `${osrmBaseUrl}/route/v1/driving/${pickup.lng},${pickup.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`OSRM route request failed: ${response.status}`);
  }

  const json = (await response.json()) as OsrmRouteResponse;
  const coordinates = json.routes?.[0]?.geometry?.coordinates ?? [];

  if (coordinates.length < 2) {
    throw new Error("OSRM returned no route geometry.");
  }

  return coordinates.map(([lng, lat]) => L.latLng(lat, lng));
}

export default function RideMapPreview({
  pickup,
  destination,
  title = "Route map preview",
  height = 280,
}: RideMapPreviewProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [routeSource, setRouteSource] = useState<RouteSource>("unavailable");

  const hasValidRoute = isValidPoint(pickup) && isValidPoint(destination);

  useEffect(() => {
    if (!mapNodeRef.current || !hasValidRoute) {
      setRouteSource("unavailable");
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;

    async function drawMap() {
      if (!mapNodeRef.current || !hasValidRoute) {
        return;
      }

      setRouteSource("loading");

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const pickupLatLng = L.latLng(pickup.lat as number, pickup.lng as number);
      const destinationLatLng = L.latLng(
        destination.lat as number,
        destination.lng as number
      );

      let routeLatLngs: L.LatLng[] = [pickupLatLng, destinationLatLng];
      let nextRouteSource: RouteSource = "fallback";

      try {
        routeLatLngs = await fetchOsrmRoute(
          { lat: pickup.lat as number, lng: pickup.lng as number },
          { lat: destination.lat as number, lng: destination.lng as number },
          abortController.signal
        );

        nextRouteSource = "osrm";
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        console.warn("OSRM route preview fallback:", error);
        routeLatLngs = [pickupLatLng, destinationLatLng];
        nextRouteSource = "fallback";
      }

      if (cancelled || !mapNodeRef.current) {
        return;
      }

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

      L.polyline(routeLatLngs, {
        color: "#111827",
        weight: 5,
        opacity: 0.78,
        dashArray: nextRouteSource === "osrm" ? undefined : "8 8",
      }).addTo(map);

      const bounds = L.latLngBounds(routeLatLngs);
      map.fitBounds(bounds.pad(0.25));

      setRouteSource(nextRouteSource);

      setTimeout(() => {
        map.invalidateSize();
      }, 120);
    }

    void drawMap();

    return () => {
      cancelled = true;
      abortController.abort();

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
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

  function getRouteSourceLabel() {
    switch (routeSource) {
      case "loading":
        return "Loading route...";
      case "osrm":
        return "OSRM road route";
      case "fallback":
        return "Direct fallback route";
      default:
        return "Map preview";
    }
  }

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
            Free route preview powered by OpenStreetMap, Leaflet, and OSRM.
          </div>
        </div>

        <span
          style={{
            borderRadius: 999,
            padding: "6px 10px",
            background: routeSource === "osrm" ? "#ecfdf5" : "#fff7ed",
            color: routeSource === "osrm" ? "#047857" : "#9a3412",
            fontWeight: 800,
            fontSize: 12,
          }}
        >
          {getRouteSourceLabel()}
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
