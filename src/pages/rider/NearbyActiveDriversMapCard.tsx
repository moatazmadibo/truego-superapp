import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "../../lib/supabase";
import type { RideStage } from "../../services/rideApi";

type MapPoint = {
  lat: number;
  lng: number;
  label: string;
};

type DemoDriverMapRow = {
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
};

type NearbyDriver = DemoDriverMapRow & {
  mapLat: number;
  mapLng: number;
  distanceKm: number;
};

function shouldShowNearbyDrivers(status: RideStage) {
  return ["searching", "offer_sent", "no_driver_available"].includes(status);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceKm(a: MapPoint, b: { lat: number; lng: number }) {
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

function getDriverPoint(driver: DemoDriverMapRow) {
  const lat = driver.current_lat ?? driver.lat;
  const lng = driver.current_lng ?? driver.lng;

  if (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng)
  ) {
    return { lat, lng };
  }

  return null;
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

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleTimeString() : "N/A";
}

function NearbyDriversMap({
  pickup,
  destination,
  drivers,
}: {
  pickup: MapPoint;
  destination: MapPoint;
  drivers: NearbyDriver[];
}) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapNodeRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const pickupLatLng = L.latLng(pickup.lat, pickup.lng);
    const destinationLatLng = L.latLng(destination.lat, destination.lng);

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
      .bindPopup(pickup.label);

    L.marker(destinationLatLng, { icon: markerIcon("D", "#16a34a") })
      .addTo(map)
      .bindPopup(destination.label);

    L.polyline([pickupLatLng, destinationLatLng], {
      color: "#94a3b8",
      weight: 3,
      opacity: 0.65,
      dashArray: "8 8",
    }).addTo(map);

    const boundsPoints = [pickupLatLng, destinationLatLng];

    for (const driver of drivers) {
      const point = L.latLng(driver.mapLat, driver.mapLng);
      boundsPoints.push(point);

      L.marker(point, { icon: markerIcon("🚗", "#111827") })
        .addTo(map)
        .bindPopup(
          `${driver.display_name}<br/>${driver.vehicle_type}<br/>${driver.distanceKm.toFixed(
            2
          )} km from pickup`
        );
    }

    map.fitBounds(L.latLngBounds(boundsPoints).pad(0.3));

    setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [
    pickup.lat,
    pickup.lng,
    pickup.label,
    destination.lat,
    destination.lng,
    destination.label,
    drivers,
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

export default function NearbyActiveDriversMapCard({
  rideStatus,
  pickup,
  destination,
}: {
  rideStatus: RideStage;
  pickup: MapPoint;
  destination: MapPoint;
}) {
  const [drivers, setDrivers] = useState<DemoDriverMapRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!shouldShowNearbyDrivers(rideStatus)) {
      setDrivers([]);
      return;
    }

    let mounted = true;
    let pollingId: number | null = null;

    async function loadDrivers() {
      setError("");

      const { data, error: loadError } = await supabase
        .from("demo_drivers")
        .select(
          "id, display_name, vehicle_type, is_online, is_available, rating, lat, lng, current_lat, current_lng, last_seen_at, location_updated_at"
        )
        .eq("is_online", true)
        .eq("is_available", true);

      if (!mounted) return;

      if (loadError) {
        setError(loadError.message);
      } else {
        setDrivers((data ?? []) as DemoDriverMapRow[]);
      }
    }

    void loadDrivers();

    pollingId = window.setInterval(() => {
      void loadDrivers();
    }, 5000);

    const channel = supabase
      .channel("nearby-active-demo-drivers")
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
  }, [rideStatus]);

  const nearbyDrivers = useMemo(() => {
    return drivers
      .map((driver): NearbyDriver | null => {
        const point = getDriverPoint(driver);

        if (!point) return null;

        return {
          ...driver,
          mapLat: point.lat,
          mapLng: point.lng,
          distanceKm: distanceKm(pickup, point),
        };
      })
      .filter((driver): driver is NearbyDriver => driver != null)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 6);
  }, [drivers, pickup]);

  if (!shouldShowNearbyDrivers(rideStatus)) {
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
          <strong>Nearby active drivers</strong>
          <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
            TrueGo shows available online drivers near the pickup while your request is being matched.
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
          {nearbyDrivers.length} active
        </span>
      </div>

      {error ? <div style={noticeStyle()}>{error}</div> : null}

      {nearbyDrivers.length > 0 ? (
        <>
          <NearbyDriversMap
            pickup={pickup}
            destination={destination}
            drivers={nearbyDrivers}
          />

          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {nearbyDrivers.map((driver) => (
              <div
                key={driver.id}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  background: "#f8fafc",
                  border: "1px solid #e5e7eb",
                  color: "#334155",
                  lineHeight: 1.6,
                  fontSize: 13,
                }}
              >
                <strong>{driver.display_name}</strong> · {driver.vehicle_type} ·{" "}
                {driver.distanceKm.toFixed(2)} km from pickup
                <br />
                Rating: {driver.rating != null ? driver.rating.toFixed(1) : "N/A"} ·
                Last seen: {formatTime(driver.location_updated_at ?? driver.last_seen_at)}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={noticeStyle()}>
          No active available drivers are currently visible near the pickup. You can keep waiting or retry dispatch.
        </div>
      )}
    </div>
  );
}
