import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "../../lib/supabase";
import type { RideStage } from "../../services/rideApi";

type MapPoint = {
  lat: number;
  lng: number;
  label: string;
};

type DemoDriverLiveRow = {
  id: string;
  display_name: string;
  vehicle_type: string;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string | null;
  heading: number | null;
  speed_kph: number | null;
};

type RiderDriverLiveLocationCardProps = {
  demoDriverId: string | null;
  rideStatus: RideStage;
  pickup: MapPoint;
  destination: MapPoint;
};

type OsrmRouteResponse = {
  routes?: Array<{
    geometry?: {
      coordinates?: Array<[number, number]>;
    };
  }>;
};

const osrmBaseUrl =
  (import.meta.env.VITE_OSRM_BASE_URL as string | undefined) ||
  "https://router.project-osrm.org";

function markerIcon(label: string, background: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 32px;
        height: 32px;
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
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function isTrackingStatus(status: RideStage) {
  return ["driver_assigned", "driver_arriving", "in_progress"].includes(status);
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not updated yet";
}

function cardStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
  };
}

function noticeStyle(): React.CSSProperties {
  return {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    color: "#0369a1",
    lineHeight: 1.6,
    fontSize: 14,
  };
}

async function fetchOsrmPolyline(
  start: L.LatLng,
  end: L.LatLng
): Promise<L.LatLng[]> {
  const url =
    `${osrmBaseUrl}/route/v1/driving/` +
    `${start.lng},${start.lat};${end.lng},${end.lat}` +
    "?overview=full&geometries=geojson";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OSRM live route failed: ${response.status}`);
  }

  const data = (await response.json()) as OsrmRouteResponse;
  const coordinates = data.routes?.[0]?.geometry?.coordinates ?? [];

  if (coordinates.length < 2) {
    throw new Error("OSRM returned no live route geometry.");
  }

  return coordinates.map(([lng, lat]) => L.latLng(lat, lng));
}

function LiveDriverMap({
  pickup,
  destination,
  driver,
  rideStatus,
}: {
  pickup: MapPoint;
  destination: MapPoint;
  driver: DemoDriverLiveRow;
  rideStatus: RideStage;
}) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const tripLineRef = useRef<L.Polyline | null>(null);
  const driverRouteLineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (
      !mapNodeRef.current ||
      mapRef.current ||
      driver.current_lat == null ||
      driver.current_lng == null
    ) {
      return;
    }

    const pickupLatLng = L.latLng(pickup.lat, pickup.lng);
    const destinationLatLng = L.latLng(destination.lat, destination.lng);
    const driverLatLng = L.latLng(
      Number(driver.current_lat),
      Number(driver.current_lng)
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

    pickupMarkerRef.current = L.marker(pickupLatLng, {
      icon: markerIcon("P", "#0ea5e9"),
    })
      .addTo(map)
      .bindPopup(pickup.label);

    destinationMarkerRef.current = L.marker(destinationLatLng, {
      icon: markerIcon("D", "#16a34a"),
    })
      .addTo(map)
      .bindPopup(destination.label);

    driverMarkerRef.current = L.marker(driverLatLng, {
      icon: markerIcon("🚗", "#111827"),
    })
      .addTo(map)
      .bindPopup(driver.display_name || "Driver");

    map.fitBounds(
      L.latLngBounds([pickupLatLng, destinationLatLng, driverLatLng]).pad(0.25)
    );

    setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [
    destination.lat,
    destination.lng,
    destination.label,
    driver.current_lat,
    driver.current_lng,
    driver.display_name,
    pickup.lat,
    pickup.lng,
    pickup.label,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (
      !map ||
      driver.current_lat == null ||
      driver.current_lng == null ||
      !driverMarkerRef.current
    ) {
      return;
    }

    const liveMap = map;

    const pickupLatLng = L.latLng(pickup.lat, pickup.lng);
    const destinationLatLng = L.latLng(destination.lat, destination.lng);
    const driverLatLng = L.latLng(
      Number(driver.current_lat),
      Number(driver.current_lng)
    );

    driverMarkerRef.current.setLatLng(driverLatLng);
    driverMarkerRef.current.setPopupContent(driver.display_name || "Driver");

    if (tripLineRef.current) {
      tripLineRef.current.remove();
      tripLineRef.current = null;
    }

    tripLineRef.current = L.polyline([pickupLatLng, destinationLatLng], {
      color: "#94a3b8",
      weight: 3,
      opacity: 0.65,
      dashArray: "8 8",
    }).addTo(map);

    const targetLatLng =
      rideStatus === "in_progress" ? destinationLatLng : pickupLatLng;

    let cancelled = false;

    async function drawDriverRoute() {
      if (driverRouteLineRef.current) {
        driverRouteLineRef.current.remove();
        driverRouteLineRef.current = null;
      }

      try {
        const route = await fetchOsrmPolyline(driverLatLng, targetLatLng);

        if (cancelled) return;

        driverRouteLineRef.current = L.polyline(route, {
          color: rideStatus === "in_progress" ? "#16a34a" : "#0ea5e9",
          weight: 5,
          opacity: 0.82,
        }).addTo(liveMap);

        liveMap.fitBounds(
          L.latLngBounds([pickupLatLng, destinationLatLng, driverLatLng]).pad(0.25)
        );
      } catch (error) {
        console.warn("Live driver OSRM fallback:", error);

        if (cancelled) return;

        driverRouteLineRef.current = L.polyline([driverLatLng, targetLatLng], {
          color: rideStatus === "in_progress" ? "#16a34a" : "#0ea5e9",
          weight: 5,
          opacity: 0.82,
          dashArray: "8 8",
        }).addTo(liveMap);

        liveMap.fitBounds(
          L.latLngBounds([pickupLatLng, destinationLatLng, driverLatLng]).pad(0.25)
        );
      }
    }

    void drawDriverRoute();

    return () => {
      cancelled = true;
    };
  }, [
    destination.lat,
    destination.lng,
    driver.current_lat,
    driver.current_lng,
    driver.display_name,
    pickup.lat,
    pickup.lng,
    rideStatus,
  ]);

  return (
    <div
      ref={mapNodeRef}
      style={{
        height: 280,
        width: "100%",
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid #cbd5e1",
        marginTop: 10,
      }}
    />
  );
}

export default function RiderDriverLiveLocationCard({
  demoDriverId,
  rideStatus,
  pickup,
  destination,
}: RiderDriverLiveLocationCardProps) {
  const [driver, setDriver] = useState<DemoDriverLiveRow | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!demoDriverId || !isTrackingStatus(rideStatus)) {
      setDriver(null);
      return;
    }

    let mounted = true;
    let pollingId: number | null = null;

    async function loadDriverLocation() {
      setError("");

      const { data, error: loadError } = await supabase
        .from("demo_drivers")
        .select(
          "id, display_name, vehicle_type, current_lat, current_lng, location_updated_at, heading, speed_kph"
        )
        .eq("id", demoDriverId)
        .maybeSingle();

      if (!mounted) return;

      if (loadError) {
        setError(loadError.message);
      } else {
        setDriver(data as DemoDriverLiveRow | null);
      }
    }

    void loadDriverLocation();

    pollingId = window.setInterval(() => {
      void loadDriverLocation();
    }, 2500);

    const channel = supabase
      .channel(`driver-live-location-${demoDriverId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "demo_drivers",
          filter: `id=eq.${demoDriverId}`,
        },
        (payload) => {
          setDriver(payload.new as DemoDriverLiveRow);
        }
      )
      .subscribe();

    return () => {
      mounted = false;

      if (pollingId != null) {
        window.clearInterval(pollingId);
      }

      void supabase.removeChannel(channel);
    };
  }, [demoDriverId, rideStatus]);

  if (!demoDriverId || !isTrackingStatus(rideStatus)) {
    return null;
  }

  return (
    <div style={cardStyle()}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <strong>Driver live location</strong>
          <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
            {rideStatus === "in_progress"
              ? "Trip in progress. Driver route is drawn toward the destination."
              : "Driver route is drawn toward the pickup point."}
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
          Live + OSRM
        </span>
      </div>

      {error ? (
        <div style={noticeStyle()}>{error}</div>
      ) : driver?.current_lat != null && driver.current_lng != null ? (
        <>
          <LiveDriverMap
            pickup={pickup}
            destination={destination}
            driver={driver}
            rideStatus={rideStatus}
          />

          <div style={noticeStyle()}>
            <strong>Driver:</strong> {driver.display_name} ·{" "}
            <strong>Vehicle:</strong> {driver.vehicle_type}
            <br />
            <strong>Last location update:</strong>{" "}
            {formatDateTime(driver.location_updated_at)}
            {driver.speed_kph != null ? (
              <>
                <br />
                <strong>Speed:</strong> {Number(driver.speed_kph).toFixed(1)} km/h
              </>
            ) : null}
          </div>
        </>
      ) : (
        <div style={noticeStyle()}>
          Waiting for the driver to share live location. The marker will appear
          here after the driver grants location permission or starts demo movement.
        </div>
      )}
    </div>
  );
}
