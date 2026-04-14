import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import type { Ride } from "../../types/ride";
import RideTimeline from "../../components/RideTimeline";
import StatusBadge from "../../components/StatusBadge";
import {
  getRideById,
  subscribeToRide,
  syncDemoRideOfferState,
  type RideRow,
} from "../../services/rideApi";

function mapRideRowToRide(row: RideRow): Ride {
  return {
    id: row.id,
    riderId: row.rider_user_id ?? "rider-1",
    driverId: row.driver_user_id ?? undefined,
    pickupText: row.pickup_text,
    destinationText: row.destination_text,
    pickup: {
      lat: row.pickup_lat ?? 0,
      lng: row.pickup_lng ?? 0,
    },
    destination: {
      lat: row.destination_lat ?? 0,
      lng: row.destination_lng ?? 0,
    },
    distanceKm: row.distance_km,
    durationMin: row.duration_min,
    pricePi: row.price_pi,
    vehicleType: row.vehicle_type,
    status: row.status,
    createdAt: Date.parse(row.created_at),
    acceptedAt: row.accepted_at ? Date.parse(row.accepted_at) : undefined,
    startedAt: row.started_at ? Date.parse(row.started_at) : undefined,
    completedAt: row.completed_at ? Date.parse(row.completed_at) : undefined,
  };
}

export default function RideStatus() {
  const params = useParams<{ rideId: string }>();
  const rideId = params.rideId ?? "";

  const [rideRow, setRideRow] = useState<RideRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadRide() {
      try {
        setErrorMessage("");
        const data = await getRideById(rideId);

        if (!isMounted) {
          return;
        }

        setRideRow(data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Failed to load ride status.";

        setErrorMessage(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadRide();

    const unsubscribe = subscribeToRide(rideId, (nextRide) => {
      setRideRow(nextRide);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [rideId]);

  const ride = useMemo(() => {
    if (!rideRow) {
      return null;
    }

    return mapRideRowToRide(rideRow);
  }, [rideRow]);

  useEffect(() => {
    if (!rideRow || !["searching", "offer_sent"].includes(rideRow.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const next = await syncDemoRideOfferState(rideRow.id);
          setRideRow(next);
        } catch (error) {
          console.error("Failed to sync ride offer state in rider status:", error);
        }
      })();
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [rideRow?.id, rideRow?.status]);

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <div
          style={{
            maxWidth: 700,
            margin: "40px auto",
            background: "#ffffff",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Ride Status</h2>
          <p>Loading ride...</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div style={{ padding: 20 }}>
        <div
          style={{
            maxWidth: 700,
            margin: "40px auto",
            background: "#ffffff",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Ride Status</h2>
          <p style={{ color: "crimson" }}>{errorMessage}</p>
          <Link to="/rider">Back to Rider App</Link>
        </div>
      </div>
    );
  }

  if (!ride || !rideRow) {
    return (
      <div style={{ padding: 20 }}>
        <div
          style={{
            maxWidth: 700,
            margin: "40px auto",
            background: "#ffffff",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Ride Status</h2>
          <p>Ride not found.</p>
          <Link to="/rider">Back to Rider App</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          maxWidth: 700,
          margin: "40px auto",
          background: "#ffffff",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Ride Status</h2>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
          }}
        >
          <StatusBadge status={ride.status} />

          <div style={{ marginBottom: 8 }}>
            <strong>Ride ID:</strong> {ride.id}
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Pickup:</strong> {ride.pickupText}
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Destination:</strong> {ride.destinationText}
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Distance:</strong> {ride.distanceKm} km
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Time:</strong> {ride.durationMin} min
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Price:</strong> {ride.pricePi} Pi
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Vehicle:</strong> {ride.vehicleType}
          </div>

          <div style={{ marginBottom: 8 }}>
            <strong>Driver:</strong> {rideRow.driver_name ?? "Not assigned yet"}
          </div>

          <RideTimeline ride={ride} />
        </div>

        <div style={{ marginTop: 20 }}>
          <Link to="/rider">Book Another Ride</Link>
        </div>
      </div>
    </div>
  );
}