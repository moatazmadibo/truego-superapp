import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "../../lib/supabase";
import type { RideRow, RideStage } from "../../services/rideApi";
import RouteEtaSummary from "../../components/RouteEtaSummary";

type DriverLocationRow = {
  id: string;
  display_name: string;
  vehicle_type: string;
  lat: number | null;
  lng: number | null;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string | null;
  heading: number | null;
  speed_kph: number | null;
};

type OsrmRouteResponse = {
  routes?: Array<{
    geometry?: {
      coordinates?: Array<[number, number]>;
    };
  }>;
};

type MapPoint = {
  lat: number;
  lng: number;
  label: string;
};

const osrmBaseUrl =
  (import.meta.env.VITE_OSRM_BASE_URL as string | undefined) ||
  "https://router.project-osrm.org";

function isTrackingStatus(status: RideStage) {
  return [
    "offer_sent",
    "driver_assigned",
    "driver_arriving",
    "in_progress",
  ].includes(status);
}

function isValidPoint(lat?: number | null, lng?: number | null) {
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng)
  );
}

function markerIcon(label: string, background: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 34px;
        height: 34px;
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
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
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

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "Not updated yet";
}

async function fetchOsrmPolyline(start: MapPoint, end: MapPoint) {
  const url =
    `${osrmBaseUrl}/route/v1/driving/` +
    `${start.lng},${start.lat};${end.lng},${end.lat}` +
    "?overview=full&geometries=geojson";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OSRM route failed: ${response.status}`);
  }

  const data = (await response.json()) as OsrmRouteResponse;
  const coordinates = data.routes?.[0]?.geometry?.coordinates ?? [];

  if (coordinates.length < 2) {
    throw new Error("OSRM returned no route geometry.");
  }

  return coordinates.map(([lng, lat]) => L.latLng(lat, lng));
}

function getDriverPoint(driver: DriverLocationRow | null): MapPoint | null {
  if (!driver) return null;

  if (isValidPoint(driver.current_lat, driver.current_lng)) {
    return {
      lat: Number(driver.current_lat),
      lng: Number(driver.current_lng),
      label: `${driver.display_name} live location`,
    };
  }

  if (isValidPoint(driver.lat, driver.lng)) {
    return {
      lat: Number(driver.lat),
      lng: Number(driver.lng),
      label: `${driver.display_name} base location`,
    };
  }

  return null;
}

function DriverRideMap({
  pickup,
  destination,
  driverPoint,
  driverName,
  rideStatus,
}: {
  pickup: MapPoint;
  destination: MapPoint;
  driverPoint: MapPoint | null;
  driverName: string;
  rideStatus: RideStage;
}) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    const initialCenter = driverPoint ?? pickup;

    const map = L.map(mapNodeRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    }).setView([initialCenter.lat, initialCenter.lng], 13);

    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = [];
    };
  }, [driverPoint, pickup]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const liveMap = map;

    let cancelled = false;

    for (const layer of layersRef.current) {
      layer.remove();
    }

    layersRef.current = [];

    function addLayer<T extends L.Layer>(layer: T) {
      layer.addTo(liveMap);
      layersRef.current.push(layer);
      return layer;
    }

    const pickupLatLng = L.latLng(pickup.lat, pickup.lng);
    const destinationLatLng = L.latLng(destination.lat, destination.lng);

    addLayer(
      L.marker(pickupLatLng, { icon: markerIcon("P", "#0ea5e9") }).bindPopup(
        pickup.label
      )
    );

    addLayer(
      L.marker(destinationLatLng, {
        icon: markerIcon("D", "#16a34a"),
      }).bindPopup(destination.label)
    );

    const boundsPoints = [pickupLatLng, destinationLatLng];

    if (driverPoint) {
      const driverLatLng = L.latLng(driverPoint.lat, driverPoint.lng);
      boundsPoints.push(driverLatLng);

      addLayer(
        L.marker(driverLatLng, {
          icon: markerIcon("🚗", "#111827"),
        }).bindPopup(driverName || "Driver")
      );
    }

    addLayer(
      L.polyline([pickupLatLng, destinationLatLng], {
        color: "#94a3b8",
        weight: 3,
        opacity: 0.65,
        dashArray: "8 8",
      })
    );

    const target =
      rideStatus === "in_progress" ? destination : pickup;

    async function drawDriverRoute() {
      if (!driverPoint) return;

      try {
        const route = await fetchOsrmPolyline(driverPoint, target);

        if (cancelled) return;

        addLayer(
          L.polyline(route, {
            color: rideStatus === "in_progress" ? "#16a34a" : "#0ea5e9",
            weight: 5,
            opacity: 0.82,
          })
        );
      } catch (error) {
        console.warn("Driver map OSRM fallback:", error);

        if (cancelled) return;

        addLayer(
          L.polyline(
            [
              L.latLng(driverPoint.lat, driverPoint.lng),
              L.latLng(target.lat, target.lng),
            ],
            {
              color: rideStatus === "in_progress" ? "#16a34a" : "#0ea5e9",
              weight: 5,
              opacity: 0.82,
              dashArray: "8 8",
            }
          )
        );
      }

      liveMap.fitBounds(L.latLngBounds(boundsPoints).pad(0.25));
    }

    liveMap.fitBounds(L.latLngBounds(boundsPoints).pad(0.25));
    void drawDriverRoute();

    return () => {
      cancelled = true;
    };
  }, [
    destination.lat,
    destination.lng,
    destination.label,
    driverName,
    driverPoint?.lat,
    driverPoint?.lng,
    pickup.lat,
    pickup.lng,
    pickup.label,
    rideStatus,
  ]);

  return (
    <div
      ref={mapNodeRef}
      style={{
        height: 300,
        width: "100%",
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid #cbd5e1",
        marginTop: 10,
      }}
    />
  );
}

export default function DriverRideMapCard({
  driverId,
  ride,
}: {
  driverId: string;
  ride: RideRow;
}) {
  const [driver, setDriver] = useState<DriverLocationRow | null>(null);
  const [error, setError] = useState("");

  const hasRouteCoordinates =
    isValidPoint(ride.pickup_lat, ride.pickup_lng) &&
    isValidPoint(ride.destination_lat, ride.destination_lng);

  useEffect(() => {
    if (!driverId || !isTrackingStatus(ride.status)) {
      setDriver(null);
      return;
    }

    let mounted = true;
    let pollingId: number | null = null;

    async function loadDriver() {
      setError("");

      const { data, error: loadError } = await supabase
        .from("demo_drivers")
        .select(
          "id, display_name, vehicle_type, lat, lng, current_lat, current_lng, location_updated_at, heading, speed_kph"
        )
        .eq("id", driverId)
        .maybeSingle();

      if (!mounted) return;

      if (loadError) {
        setError(loadError.message);
      } else {
        setDriver(data as DriverLocationRow | null);
      }
    }

    void loadDriver();

    pollingId = window.setInterval(() => {
      void loadDriver();
    }, 2500);

    const channel = supabase
      .channel(`driver-operation-map-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "demo_drivers",
          filter: `id=eq.${driverId}`,
        },
        (payload) => {
          setDriver(payload.new as DriverLocationRow);
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
  }, [driverId, ride.status]);

  if (!isTrackingStatus(ride.status)) {
    return null;
  }

  if (!hasRouteCoordinates) {
    return (
      <div style={cardStyle()}>
        <strong>Driver route map</strong>
        <div style={noticeStyle()}>
          Route map will appear after pickup and destination coordinates are available.
        </div>
      </div>
    );
  }

  const pickup: MapPoint = {
    lat: Number(ride.pickup_lat),
    lng: Number(ride.pickup_lng),
    label: ride.pickup_text || "Pickup",
  };

  const destination: MapPoint = {
    lat: Number(ride.destination_lat),
    lng: Number(ride.destination_lng),
    label: ride.destination_text || "Destination",
  };

  const driverPoint = getDriverPoint(driver);

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
          <strong>Driver route map</strong>
          <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
            {ride.status === "in_progress"
              ? "Follow the road route toward the destination."
              : "Follow the road route toward the pickup point."}
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
          Driver map + OSRM
        </span>
      </div>

      {error ? <div style={noticeStyle()}>{error}</div> : null}

      <DriverRideMap
        pickup={pickup}
        destination={destination}
        driverPoint={driverPoint}
        driverName={driver?.display_name ?? "Driver"}
        rideStatus={ride.status}
      />

      {driverPoint ? (
        <RouteEtaSummary
          startLat={driverPoint.lat}
          startLng={driverPoint.lng}
          targetLat={ride.status === "in_progress" ? destination.lat : pickup.lat}
          targetLng={ride.status === "in_progress" ? destination.lng : pickup.lng}
          targetLabel={ride.status === "in_progress" ? "destination" : "pickup"}
        />
      ) : null}

      <div style={noticeStyle()}>
        <strong>Live point:</strong>{" "}
        {driverPoint ? driverPoint.label : "Waiting for driver location"}
        <br />
        <strong>Last location update:</strong>{" "}
        {formatDateTime(driver?.location_updated_at)}
        {driver?.speed_kph != null ? (
          <>
            <br />
            <strong>Speed:</strong> {Number(driver.speed_kph).toFixed(1)} km/h
          </>
        ) : null}
      </div>
    </div>
  );
}
