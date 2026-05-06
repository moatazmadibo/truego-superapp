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

  useEffect(() => {
    if (
      !mapNodeRef.current ||
      driver.current_lat == null ||
      driver.current_lng == null
    ) {
      return;
    }

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
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

    L.marker(pickupLatLng, { icon: markerIcon("P", "#0ea5e9") })
      .addTo(map)
      .bindPopup(pickup.label);

    L.marker(destinationLatLng, { icon: markerIcon("D", "#16a34a") })
      .addTo(map)
      .bindPopup(destination.label);

    L.marker(driverLatLng, { icon: markerIcon("🚗", "#111827") })
      .addTo(map)
      .bindPopup(driver.display_name || "Driver");

    L.polyline([pickupLatLng, destinationLatLng], {
      color: "#94a3b8",
      weight: 3,
      opacity: 0.65,
      dashArray: "8 8",
    }).addTo(map);

    const targetLatLng =
      rideStatus === "in_progress" ? destinationLatLng : pickupLatLng;

    L.polyline([driverLatLng, targetLatLng], {
      color: rideStatus === "in_progress" ? "#16a34a" : "#0ea5e9",
      weight: 5,
      opacity: 0.78,
    }).addTo(map);

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
              ? "Trip in progress. Driver is moving toward the destination."
              : "Driver is moving toward the pickup point."}
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
          Supabase Realtime
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
          here after the driver grants location permission.
        </div>
      )}
    </div>
  );
}
