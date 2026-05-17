import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "../lib/supabase";
import type { RideRow, RideStage } from "../services/rideApi";
import RouteEtaSummary from "./RouteEtaSummary";

type Viewer = "rider" | "driver" | "admin";

type MapPoint = {
  lat: number;
  lng: number;
  label: string;
};

type DriverMapRow = {
  id: string;
  display_name: string;
  vehicle_type: string;
  is_online: boolean;
  is_available: boolean;
  rating: number | null;
  lat: number | null;
  lng: number | null;
  current_lat: number | null;
  current_lng: number | null;
  last_seen_at: string | null;
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

const osrmBaseUrl =
  (import.meta.env.VITE_OSRM_BASE_URL as string | undefined) ||
  "https://router.project-osrm.org";

function isValidPoint(lat?: number | null, lng?: number | null) {
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng)
  );
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceKm(a: MapPoint, b: MapPoint) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);

  const part =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(deltaLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(part), Math.sqrt(1 - part));
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

function errorStyle(): React.CSSProperties {
  return {
    ...noticeStyle(),
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
  };
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "Not updated yet";
}

function getDriverPoint(driver: DriverMapRow | null): MapPoint | null {
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

function shouldShowAvailableDrivers(status: RideStage) {
  return [
    "searching",
    "collecting_offers",
    "offer_sent",
    "offers_expired",
    "no_driver_available",
  ].includes(status);
}

function shouldTrackSelectedDriver(status: RideStage) {
  return [
    "driver_assigned",
    "driver_arriving",
    "in_progress",
    "completed",
  ].includes(status);
}

function mapSubtitle(status: RideStage, viewer: Viewer) {
  if (status === "collecting_offers") {
    return "Pickup, destination, and available drivers are visible while drivers send offers.";
  }

  if (status === "driver_assigned" || status === "driver_arriving") {
    return "Selected driver is moving toward the pickup point.";
  }

  if (status === "in_progress") {
    return "Trip is in progress. Route follows the selected driver toward the destination.";
  }

  if (status === "completed") {
    return "Trip completed. Map shows pickup, destination, and final driver position.";
  }

  if (viewer === "driver") {
    return "Use this map to understand pickup, destination, and active route.";
  }

  return "TrueGo shows pickup, destination, available drivers, and live trip movement on one map.";
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

function LiveMapCanvas({
  pickup,
  destination,
  selectedDriver,
  availableDrivers,
  rideStatus,
}: {
  pickup: MapPoint;
  destination: MapPoint;
  selectedDriver: DriverMapRow | null;
  availableDrivers: DriverMapRow[];
  rideStatus: RideStage;
}) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);

  const selectedDriverPoint = getDriverPoint(selectedDriver);

  const availableDriverPoints = useMemo(() => {
    return availableDrivers
      .map((driver) => {
        const point = getDriverPoint(driver);
        return point ? { driver, point } : null;
      })
      .filter(
        (item): item is { driver: DriverMapRow; point: MapPoint } => item != null
      )
      .sort(
        (a, b) =>
          distanceKm(pickup, a.point) - distanceKm(pickup, b.point)
      )
      .slice(0, 8);
  }, [availableDrivers, pickup]);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    const map = L.map(mapNodeRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    }).setView([pickup.lat, pickup.lng], 13);

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
  }, [pickup.lat, pickup.lng]);

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
      layer.addTo(map as L.Map);
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

    addLayer(
      L.polyline([pickupLatLng, destinationLatLng], {
        color: "#94a3b8",
        weight: 3,
        opacity: 0.65,
        dashArray: rideStatus === "completed" ? undefined : "8 8",
      })
    );

    if (shouldShowAvailableDrivers(rideStatus)) {
      for (const { driver, point } of availableDriverPoints) {
        const driverLatLng = L.latLng(point.lat, point.lng);
        boundsPoints.push(driverLatLng);

        addLayer(
          L.marker(driverLatLng, {
            icon: markerIcon("🚗", "#7c3aed"),
          }).bindPopup(
            `${driver.display_name}<br/>${driver.vehicle_type}<br/>${distanceKm(
              pickup,
              point
            ).toFixed(2)} km from pickup`
          )
        );
      }
    }

    if (selectedDriverPoint) {
      const selectedDriverLatLng = L.latLng(
        selectedDriverPoint.lat,
        selectedDriverPoint.lng
      );

      boundsPoints.push(selectedDriverLatLng);

      addLayer(
        L.marker(selectedDriverLatLng, {
          icon: markerIcon("🚕", "#111827"),
        }).bindPopup(selectedDriver?.display_name || "Selected driver")
      );
    }

    async function drawSelectedDriverRoute() {
      if (!selectedDriverPoint || !shouldTrackSelectedDriver(rideStatus)) {
        liveMap.fitBounds(L.latLngBounds(boundsPoints).pad(0.25));
        return;
      }

      const target =
        rideStatus === "in_progress" || rideStatus === "completed"
          ? destination
          : pickup;

      try {
        const route = await fetchOsrmPolyline(selectedDriverPoint, target);

        if (cancelled) return;

        addLayer(
          L.polyline(route, {
            color: rideStatus === "in_progress" ? "#16a34a" : "#0ea5e9",
            weight: 5,
            opacity: 0.82,
          })
        );
      } catch (error) {
        console.warn("TrueGo live map OSRM fallback:", error);

        if (cancelled) return;

        addLayer(
          L.polyline(
            [
              L.latLng(selectedDriverPoint.lat, selectedDriverPoint.lng),
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

    void drawSelectedDriverRoute();

    return () => {
      cancelled = true;
    };
  }, [
    availableDriverPoints,
    destination.lat,
    destination.lng,
    destination.label,
    pickup.lat,
    pickup.lng,
    pickup.label,
    rideStatus,
    selectedDriver?.display_name,
    selectedDriverPoint?.lat,
    selectedDriverPoint?.lng,
  ]);

  return (
    <div
      ref={mapNodeRef}
      style={{
        height: 320,
        width: "100%",
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid #cbd5e1",
        marginTop: 10,
      }}
    />
  );
}

export default function TrueGoLiveMapCard({
  ride,
  viewer = "rider",
  selectedDriverId,
}: {
  ride: RideRow;
  viewer?: Viewer;
  selectedDriverId?: string | null;
}) {
  const [availableDrivers, setAvailableDrivers] = useState<DriverMapRow[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverMapRow | null>(null);
  const [error, setError] = useState("");

  const hasRouteCoordinates =
    isValidPoint(ride.pickup_lat, ride.pickup_lng) &&
    isValidPoint(ride.destination_lat, ride.destination_lng);

  const driverId = selectedDriverId ?? ride.demo_driver_id ?? null;

  const pickup: MapPoint | null = hasRouteCoordinates
    ? {
        lat: Number(ride.pickup_lat),
        lng: Number(ride.pickup_lng),
        label: ride.pickup_text || "Pickup",
      }
    : null;

  const destination: MapPoint | null = hasRouteCoordinates
    ? {
        lat: Number(ride.destination_lat),
        lng: Number(ride.destination_lng),
        label: ride.destination_text || "Destination",
      }
    : null;

  useEffect(() => {
    let mounted = true;
    let pollingId: number | null = null;

    async function loadDrivers() {
      setError("");

      try {
        if (shouldShowAvailableDrivers(ride.status)) {
          const { data, error: availableError } = await supabase
            .from("demo_drivers")
            .select(
              "id, display_name, vehicle_type, is_online, is_available, rating, lat, lng, current_lat, current_lng, last_seen_at, location_updated_at, heading, speed_kph"
            )
            .eq("is_online", true)
            .eq("is_available", true);

          if (availableError) {
            throw availableError;
          }

          if (mounted) {
            setAvailableDrivers((data ?? []) as DriverMapRow[]);
          }
        } else if (mounted) {
          setAvailableDrivers([]);
        }

        if (driverId) {
          const { data, error: selectedError } = await supabase
            .from("demo_drivers")
            .select(
              "id, display_name, vehicle_type, is_online, is_available, rating, lat, lng, current_lat, current_lng, last_seen_at, location_updated_at, heading, speed_kph"
            )
            .eq("id", driverId)
            .maybeSingle();

          if (selectedError) {
            throw selectedError;
          }

          if (mounted) {
            setSelectedDriver(data as DriverMapRow | null);
          }
        } else if (mounted) {
          setSelectedDriver(null);
        }
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load live map data.";

        if (mounted) {
          setError(message);
        }
      }
    }

    void loadDrivers();

    pollingId = window.setInterval(() => {
      void loadDrivers();
    }, 3000);

    const channel = supabase
      .channel(`truego-live-map-${ride.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "demo_drivers",
        },
        () => {
          void loadDrivers();
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
  }, [driverId, ride.id, ride.status]);

  if (!hasRouteCoordinates || !pickup || !destination) {
    return (
      <div style={cardStyle()}>
        <strong>TrueGo Live Map</strong>
        <div style={noticeStyle()}>
          Map will appear after pickup and destination coordinates are available.
        </div>
      </div>
    );
  }

  const selectedDriverPoint = getDriverPoint(selectedDriver);

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
          <strong>TrueGo Live Map</strong>
          <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
            {mapSubtitle(ride.status, viewer)}
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
          Unified map
        </span>
      </div>

      {error ? <div style={errorStyle()}>{error}</div> : null}

      <LiveMapCanvas
        pickup={pickup}
        destination={destination}
        selectedDriver={selectedDriver}
        availableDrivers={availableDrivers}
        rideStatus={ride.status}
      />

      {selectedDriverPoint && shouldTrackSelectedDriver(ride.status) ? (
        <RouteEtaSummary
          startLat={selectedDriverPoint.lat}
          startLng={selectedDriverPoint.lng}
          targetLat={ride.status === "in_progress" ? destination.lat : pickup.lat}
          targetLng={ride.status === "in_progress" ? destination.lng : pickup.lng}
          targetLabel={ride.status === "in_progress" ? "destination" : "pickup"}
        />
      ) : null}

      <div style={noticeStyle()}>
        <strong>Pickup:</strong> {ride.pickup_text}
        <br />
        <strong>Destination:</strong> {ride.destination_text}
        <br />
        <strong>Status:</strong> {ride.status}
        {selectedDriver ? (
          <>
            <br />
            <strong>Selected driver:</strong> {selectedDriver.display_name}
            <br />
            <strong>Last location update:</strong>{" "}
            {formatDateTime(selectedDriver.location_updated_at)}
            {selectedDriver.speed_kph != null ? (
              <>
                <br />
                <strong>Speed:</strong>{" "}
                {Number(selectedDriver.speed_kph).toFixed(1)} km/h
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
