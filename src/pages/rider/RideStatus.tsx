import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Ride } from "../../types/ride";
import RideTimeline from "../../components/RideTimeline";
import StatusBadge from "../../components/StatusBadge";
import {
  getRideById,
  retryDemoRideDispatch,
  subscribeToRide,
  syncDemoRideOfferState,
  type RideRow,
} from "../../services/rideApi";
import {
  demoFareToPayablePi,
  formatInternalRate,
  formatPiAmount,
} from "../../lib/piPricing";
import {
  ensurePiPaymentsScope,
  getStoredPiSession,
  saveStoredPiSession,
} from "../../lib/pi";
import { createPiPayment } from "../../services/piPlatform";
import {
  approvePiRidePayment,
  completePiRidePayment,
} from "../../services/piPaymentApi";

type RidePaymentSnapshot = {
  payment_status?: "unpaid" | "approved" | "completed" | "cancelled" | "failed" | null;
  payment_provider?: string | null;
  payment_id?: string | null;
  payment_txid?: string | null;
  payment_amount_pi?: number | null;
  payment_completed_at?: string | null;
};

function containerStyle(): React.CSSProperties {
  return {
    maxWidth: 720,
    margin: "40px auto",
    background: "#ffffff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
  };
}

function sectionStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  };
}

function detailGridStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginTop: 12,
  };
}

function detailItemStyle(): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 10,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
  };
}

function actionButtonStyle(
  background: string,
  disabled = false
): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid transparent",
    background,
    color: "#ffffff",
    fontWeight: 600,
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

function secondaryLinkStyle(): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 600,
    textDecoration: "none",
  };
}

function paidBadgeStyle(): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 700,
    fontSize: 13,
  };
}

function mapRideRowToRide(row: RideRow): Ride {
  return {
    id: row.id,
    riderId: row.rider_user_id ?? "demo-rider",
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

function getStatusMessage(status: RideRow["status"]): string {
  switch (status) {
    case "searching":
      return "We are searching for the best nearby driver for your trip.";
    case "offer_sent":
      return "A ride offer has been sent to a nearby driver. Waiting for response.";
    case "driver_assigned":
      return "Your driver has accepted the ride and is assigned.";
    case "driver_arriving":
      return "Your driver is on the way to the pickup point.";
    case "in_progress":
      return "Your ride is currently in progress.";
    case "completed":
      return "Your trip has been completed successfully.";
    case "cancelled":
      return "This ride was cancelled.";
    case "no_driver_available":
      return "No driver accepted the trip. You can retry dispatch now.";
    default:
      return status;
  }
}

function getPaymentSnapshot(row: RideRow | null): RidePaymentSnapshot {
  if (!row) {
    return {};
  }

  const extended = row as RideRow & RidePaymentSnapshot;

  return {
    payment_status: extended.payment_status ?? "unpaid",
    payment_provider: extended.payment_provider ?? null,
    payment_id: extended.payment_id ?? null,
    payment_txid: extended.payment_txid ?? null,
    payment_amount_pi: extended.payment_amount_pi ?? null,
    payment_completed_at: extended.payment_completed_at ?? null,
  };
}

function formatPaymentStatus(status?: RidePaymentSnapshot["payment_status"]) {
  switch (status) {
    case "approved":
      return "Approved on TrueGo server";
    case "completed":
      return "Completed on Pi";
    case "cancelled":
      return "Cancelled";
    case "failed":
      return "Failed";
    case "unpaid":
    default:
      return "Unpaid";
  }
}

export default function RideStatus() {
  const params = useParams<{ rideId: string }>();
  const rideId = params.rideId ?? "";

  const [rideRow, setRideRow] = useState<RideRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");

  useEffect(() => {
    if (!rideId) {
      setRideRow(null);
      setLoading(false);
      setErrorMessage("Missing ride ID.");
      return;
    }

    let isMounted = true;

    async function refreshRide(showSpinner: boolean) {
      try {
        if (showSpinner) {
          setLoading(true);
        }

        await syncDemoRideOfferState(rideId);
        const data = await getRideById(rideId);

        if (!isMounted) {
          return;
        }

        setErrorMessage("");
        setRideRow(data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Failed to load ride status.";

        setErrorMessage(message);
      } finally {
        if (isMounted && showSpinner) {
          setLoading(false);
        }
      }
    }

    void refreshRide(true);

    const unsubscribe = subscribeToRide(rideId, (nextRide) => {
      if (!isMounted) {
        return;
      }

      setErrorMessage("");
      setRideRow(nextRide);
    });

    const intervalId = window.setInterval(() => {
      void refreshRide(false);
    }, 10000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      unsubscribe();
    };
  }, [rideId]);

  const ride = useMemo(() => {
    if (!rideRow) {
      return null;
    }

    return mapRideRowToRide(rideRow);
  }, [rideRow]);

  const payment = useMemo(() => getPaymentSnapshot(rideRow), [rideRow]);

  const payablePi = useMemo(() => {
    if (!ride) {
      return 0;
    }

    return demoFareToPayablePi(ride.pricePi);
  }, [ride]);

  const piSession = useMemo(() => getStoredPiSession(), []);
  const canRetryDispatch =
    rideRow?.status === "no_driver_available" || rideRow?.status === "cancelled";

  const isPaid = payment.payment_status === "completed";

  const canPayWithPi =
    Boolean(ride && piSession) &&
    payablePi > 0 &&
    rideRow?.status === "completed" &&
    !isPaid;

  async function refreshCurrentRide() {
    if (!rideId) {
      return;
    }

    const data = await getRideById(rideId);
    setRideRow(data);
  }

  async function handleRetryDispatch() {
    if (!rideId) {
      return;
    }

    setActionLoading(true);
    setErrorMessage("");

    try {
      await retryDemoRideDispatch(rideId);
      await syncDemoRideOfferState(rideId);

      const data = await getRideById(rideId);
      setRideRow(data);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to retry ride dispatch.";
      setErrorMessage(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePayWithPi() {
    if (!ride || !piSession) {
      setErrorMessage("Login with Pi first from the home screen.");
      return;
    }

    setPaymentLoading(true);
    setErrorMessage("");
    setPaymentMessage("Preparing Pi payment access...");

    try {
      const paymentLogin = await ensurePiPaymentsScope();
      saveStoredPiSession(paymentLogin.session);

      setPaymentMessage("Opening Pi payment flow...");

      createPiPayment(
        {
          amount: payablePi,
          memo: `TrueGo ride ${ride.id}`,
          metadata: {
            rideId: ride.id,
            internalFareUsd: ride.pricePi,
            payablePi,
            vehicleType: ride.vehicleType,
            destination: ride.destinationText,
          },
          uid: paymentLogin.session.uid,
        },
        {
          onReadyForServerApproval: async (paymentId) => {
            setPaymentMessage("Approving payment on TrueGo server...");
            await approvePiRidePayment({
              rideId: ride.id,
              paymentId,
              amountPi: payablePi,
            });
            setPaymentMessage("Payment approved. Waiting for blockchain confirmation...");
            await refreshCurrentRide();
          },
          onReadyForServerCompletion: async (paymentId, txid) => {
            setPaymentMessage("Completing Pi payment...");
            await completePiRidePayment({
              rideId: ride.id,
              paymentId,
              txid,
              amountPi: payablePi,
            });
            setPaymentMessage("Payment completed successfully.");
            await refreshCurrentRide();
            setPaymentLoading(false);
          },
          onCancel: () => {
            setPaymentMessage("Payment was cancelled.");
            setPaymentLoading(false);
          },
          onError: (error) => {
            setErrorMessage(error.message || "Pi payment failed.");
            setPaymentLoading(false);
          },
        }
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Pi payment could not start.";
      setErrorMessage(message);
      setPaymentLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={containerStyle()}>
        <h2 style={{ marginTop: 0 }}>Ride Status</h2>
        <p style={{ marginBottom: 0 }}>Loading ride...</p>
      </div>
    );
  }

  if (errorMessage && !rideRow) {
    return (
      <div style={containerStyle()}>
        <h2 style={{ marginTop: 0 }}>Ride Status</h2>
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: "#fef2f2",
            color: "#b91c1c",
            border: "1px solid #fecaca",
            marginBottom: 16,
          }}
        >
          {errorMessage}
        </div>

        <Link to="/rider" style={secondaryLinkStyle()}>
          Back to Rider App
        </Link>
      </div>
    );
  }

  if (!rideRow || !ride) {
    return (
      <div style={containerStyle()}>
        <h2 style={{ marginTop: 0 }}>Ride Status</h2>
        <p>Ride not found.</p>

        <Link to="/rider" style={secondaryLinkStyle()}>
          Back to Rider App
        </Link>
      </div>
    );
  }

  return (
    <div style={containerStyle()}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Ride Status</h2>
          <p style={{ margin: "8px 0 0", color: "#6b7280" }}>
            Ride ID: {ride.id}
          </p>
        </div>

        <StatusBadge status={ride.status} />
      </div>

      <div style={sectionStyle()}>
        <p style={{ margin: 0, fontWeight: 600 }}>{getStatusMessage(rideRow.status)}</p>

        {errorMessage ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        {paymentMessage ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              background: "#eff6ff",
              color: "#1d4ed8",
              border: "1px solid #bfdbfe",
            }}
          >
            {paymentMessage}
          </div>
        ) : null}

        {isPaid ? (
          <div style={{ marginTop: 12 }}>
            <span style={paidBadgeStyle()}>Paid via Pi</span>
          </div>
        ) : null}
      </div>

      <div style={sectionStyle()}>
        <h3 style={{ marginTop: 0 }}>Trip details</h3>

        <div style={detailGridStyle()}>
          <div style={detailItemStyle()}>
            <strong>Pickup</strong>
            <div style={{ marginTop: 6 }}>{ride.pickupText}</div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Destination</strong>
            <div style={{ marginTop: 6 }}>{ride.destinationText}</div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Distance</strong>
            <div style={{ marginTop: 6 }}>{ride.distanceKm} km</div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Estimated time</strong>
            <div style={{ marginTop: 6 }}>{ride.durationMin} min</div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Internal fare basis</strong>
            <div style={{ marginTop: 6 }}>{ride.pricePi.toFixed(2)} USD</div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Payable in Pi</strong>
            <div style={{ marginTop: 6 }}>{formatPiAmount(payablePi)}</div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Pricing rate</strong>
            <div style={{ marginTop: 6 }}>{formatInternalRate()}</div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Vehicle</strong>
            <div style={{ marginTop: 6 }}>{ride.vehicleType}</div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Driver</strong>
            <div style={{ marginTop: 6 }}>
              {rideRow.driver_name ?? "Not assigned yet"}
            </div>
          </div>
        </div>
      </div>

      <div style={sectionStyle()}>
        <h3 style={{ marginTop: 0 }}>Payment receipt</h3>

        <div style={detailGridStyle()}>
          <div style={detailItemStyle()}>
            <strong>Payment status</strong>
            <div style={{ marginTop: 6 }}>{formatPaymentStatus(payment.payment_status)}</div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Payment provider</strong>
            <div style={{ marginTop: 6 }}>{payment.payment_provider ?? "Pi"}</div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Payment amount</strong>
            <div style={{ marginTop: 6 }}>
              {payment.payment_amount_pi != null
                ? formatPiAmount(Number(payment.payment_amount_pi))
                : "Not paid yet"}
            </div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Payment ID</strong>
            <div style={{ marginTop: 6, wordBreak: "break-all" }}>
              {payment.payment_id ?? "Not created yet"}
            </div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Transaction ID</strong>
            <div style={{ marginTop: 6, wordBreak: "break-all" }}>
              {payment.payment_txid ?? "Pending"}
            </div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Completed at</strong>
            <div style={{ marginTop: 6 }}>
              {payment.payment_completed_at
                ? new Date(payment.payment_completed_at).toLocaleString()
                : "Pending"}
            </div>
          </div>
        </div>
      </div>

      <div style={sectionStyle()}>
        <RideTimeline ride={ride} />
      </div>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {canPayWithPi ? (
          <button
            type="button"
            onClick={() => {
              void handlePayWithPi();
            }}
            disabled={paymentLoading}
            style={actionButtonStyle("#111827", paymentLoading)}
          >
            {paymentLoading ? "Processing Pi Payment..." : `Pay ${formatPiAmount(payablePi)}`}
          </button>
        ) : null}

        {isPaid ? (
          <span style={paidBadgeStyle()}>Payment already completed</span>
        ) : null}

        {!piSession ? (
          <Link to="/" style={secondaryLinkStyle()}>
            Login with Pi First
          </Link>
        ) : null}

        {canRetryDispatch ? (
          <button
            type="button"
            onClick={() => {
              void handleRetryDispatch();
            }}
            disabled={actionLoading}
            style={actionButtonStyle("#2563eb", actionLoading)}
          >
            {actionLoading ? "Retrying..." : "Retry Finding Driver"}
          </button>
        ) : null}

        <Link to="/rider" style={secondaryLinkStyle()}>
          Book Another Ride
        </Link>
      </div>
    </div>
  );
}
