import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type DriverLiveLocationTrackerProps = {
  driverId: string;
  enabled: boolean;
  showStatus?: boolean;
  demoStartLat?: number | null;
  demoStartLng?: number | null;
  targetLat?: number | null;
  targetLng?: number | null;
  targetLabel?: string;
};

type RoutePoint = {
  lat: number;
  lng: number;
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

function cardStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#047857",
    lineHeight: 1.6,
    fontSize: 14,
  };
}

function buttonStyle(background: string, disabled = false): React.CSSProperties {
  return {
    marginTop: 10,
    marginRight: 8,
    border: 0,
    borderRadius: 999,
    padding: "9px 12px",
    background,
    color: "#ffffff",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

function isValidNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value);
}

function fallbackRoutePoints(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): RoutePoint[] {
  const points: RoutePoint[] = [];
  const steps = 30;

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;

    points.push({
      lat: startLat + (endLat - startLat) * progress,
      lng: startLng + (endLng - startLng) * progress,
    });
  }

  return points;
}

async function fetchOsrmRoutePoints(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RoutePoint[]> {
  const url =
    `${osrmBaseUrl}/route/v1/driving/` +
    `${startLng},${startLat};${endLng},${endLat}` +
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

  return coordinates.map(([lng, lat]) => ({ lat, lng }));
}

function sampleRoutePoints(points: RoutePoint[], maxPoints = 45) {
  if (points.length <= maxPoints) {
    return points;
  }

  const sampled: RoutePoint[] = [];

  for (let i = 0; i < maxPoints; i += 1) {
    const index = Math.round((i / (maxPoints - 1)) * (points.length - 1));
    sampled.push(points[index]);
  }

  return sampled;
}

export default function DriverLiveLocationTracker({
  driverId,
  enabled,
  showStatus = true,
  demoStartLat,
  demoStartLng,
  targetLat,
  targetLng,
  targetLabel = "target",
}: DriverLiveLocationTrackerProps) {
  const [status, setStatus] = useState("Live location is inactive.");
  const [demoMoving, setDemoMoving] = useState(false);

  const lastSentAtRef = useRef(0);
  const demoIntervalRef = useRef<number | null>(null);
  const demoMovingRef = useRef(false);

  useEffect(() => {
    demoMovingRef.current = demoMoving;
  }, [demoMoving]);

  async function sendLocation(
    lat: number,
    lng: number,
    heading: number | null,
    speedKph: number | null,
    sourceLabel: string
  ) {
    const { error } = await supabase.rpc("update_demo_driver_live_location", {
      p_driver_id: driverId,
      p_lat: lat,
      p_lng: lng,
      p_heading: heading,
      p_speed_kph: speedKph,
    });

    if (error) {
      setStatus(`Live location update failed: ${error.message}`);
    } else {
      setStatus(`${sourceLabel}. Last update: ${new Date().toLocaleTimeString()}`);
    }
  }

  function stopDemoMovement() {
    if (demoIntervalRef.current != null) {
      window.clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }

    setDemoMoving(false);
    setStatus("Demo movement stopped. Real GPS tracking remains available.");
  }

  async function startDemoMovement() {
    if (
      !isValidNumber(demoStartLat) ||
      !isValidNumber(demoStartLng) ||
      !isValidNumber(targetLat) ||
      !isValidNumber(targetLng)
    ) {
      setStatus("Demo movement cannot start because route coordinates are missing.");
      return;
    }

    if (!enabled) {
      setStatus("Demo movement requires an active assigned or in-progress ride.");
      return;
    }

    if (demoIntervalRef.current != null) {
      window.clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }

    const startLat = Number(demoStartLat);
    const startLng = Number(demoStartLng);
    const endLat = Number(targetLat);
    const endLng = Number(targetLng);

    setDemoMoving(true);
    setStatus(`Preparing route toward ${targetLabel}...`);

    let routePoints: RoutePoint[];

    try {
      routePoints = await fetchOsrmRoutePoints(startLat, startLng, endLat, endLng);
      routePoints = sampleRoutePoints(routePoints, 45);
      setStatus(`Demo movement started on OSRM route toward ${targetLabel}.`);
    } catch (error) {
      console.warn("Demo movement OSRM fallback:", error);
      routePoints = fallbackRoutePoints(startLat, startLng, endLat, endLng);
      setStatus(`OSRM unavailable. Demo movement uses fallback path toward ${targetLabel}.`);
    }

    let index = 0;

    await sendLocation(
      routePoints[0].lat,
      routePoints[0].lng,
      null,
      18,
      "Demo driver location active"
    );

    demoIntervalRef.current = window.setInterval(() => {
      index += 1;

      const point = routePoints[Math.min(index, routePoints.length - 1)];

      void sendLocation(
        point.lat,
        point.lng,
        null,
        18,
        "Demo driver location moving"
      );

      if (index >= routePoints.length - 1) {
        stopDemoMovement();
        setStatus(`Demo movement reached ${targetLabel}.`);
      }
    }, 1200);
  }

  useEffect(() => {
    if (!enabled) {
      setStatus("Live location is inactive.");
      return;
    }

    if (!("geolocation" in navigator)) {
      setStatus("Geolocation is not supported on this device.");
      return;
    }

    setStatus("Requesting location permission...");

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (demoMovingRef.current) {
          return;
        }

        const now = Date.now();

        if (now - lastSentAtRef.current < 8000) {
          return;
        }

        lastSentAtRef.current = now;

        const speedKph =
          position.coords.speed != null && Number.isFinite(position.coords.speed)
            ? position.coords.speed * 3.6
            : null;

        void sendLocation(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.heading != null &&
            Number.isFinite(position.coords.heading)
            ? position.coords.heading
            : null,
          speedKph,
          "Real GPS live location active"
        );
      },
      (error) => {
        setStatus(`Location permission/error: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);

      if (demoIntervalRef.current != null) {
        window.clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    };
  }, [driverId, enabled]);

  if (!showStatus) {
    return null;
  }

  return (
    <div style={cardStyle()}>
      <strong>Driver live location:</strong> {status}
      <div style={{ marginTop: 6 }}>
        Location sharing is active only during assigned, arriving, or in-progress
        rides. Demo movement follows an OSRM road route when available.
      </div>

      {enabled ? (
        <div>
          <button
            type="button"
            onClick={() => {
              void startDemoMovement();
            }}
            disabled={demoMoving}
            style={buttonStyle("#0f766e", demoMoving)}
          >
            {demoMoving
              ? "Demo movement running..."
              : `Start route movement to ${targetLabel}`}
          </button>

          <button
            type="button"
            onClick={stopDemoMovement}
            disabled={!demoMoving}
            style={buttonStyle("#334155", !demoMoving)}
          >
            Stop route movement
          </button>
        </div>
      ) : null}
    </div>
  );
}
