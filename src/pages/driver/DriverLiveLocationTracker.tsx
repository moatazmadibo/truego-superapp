import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type DriverLiveLocationTrackerProps = {
  driverId: string;
  enabled: boolean;
  showStatus?: boolean;
};

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

export default function DriverLiveLocationTracker({
  driverId,
  enabled,
  showStatus = true,
}: DriverLiveLocationTrackerProps) {
  const [status, setStatus] = useState("Live location is inactive.");
  const lastSentAtRef = useRef(0);

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
        const now = Date.now();

        if (now - lastSentAtRef.current < 8000) {
          return;
        }

        lastSentAtRef.current = now;

        const speedKph =
          position.coords.speed != null && Number.isFinite(position.coords.speed)
            ? position.coords.speed * 3.6
            : null;

        void supabase
          .rpc("update_demo_driver_live_location", {
            p_driver_id: driverId,
            p_lat: position.coords.latitude,
            p_lng: position.coords.longitude,
            p_heading:
              position.coords.heading != null &&
              Number.isFinite(position.coords.heading)
                ? position.coords.heading
                : null,
            p_speed_kph: speedKph,
          })
          .then(({ error }) => {
            if (error) {
              setStatus(`Live location update failed: ${error.message}`);
            } else {
              setStatus(
                `Live location active. Last update: ${new Date().toLocaleTimeString()}`
              );
            }
          });
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
        rides.
      </div>
    </div>
  );
}
