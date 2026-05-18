import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Ride } from "../../types/ride";
import RideTimeline from "../../components/RideTimeline";
import TrueGoLiveMapCard from "../../components/TrueGoLiveMapCard";
import StatusBadge from "../../components/StatusBadge";
import ListingReadinessPanel from "../../components/ListingReadinessPanel";
import RiderIncomingDriverOfferCard from "./RiderIncomingDriverOfferCard";
import RiderOfferOutcomeActions from "./RiderOfferOutcomeActions";
import {
  expireRideDriverOfferWindow,
  getRideById,
  retryDemoRideDispatch,
  subscribeToRide,
  syncDemoRideOfferState,
  type RideRow,
} from "../../services/rideApi";
import {
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
  clearRidePiPaymentAttempt,
  completePiRidePayment,
  prepareRidePiPaymentRetry,
  registerRidePiPaymentAttempt,
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
    maxWidth: 820,
    margin: "32px auto",
    background: "#ffffff",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 18px 55px rgba(15, 23, 42, 0.12)",
    border: "1px solid #e5e7eb",
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
    paymentStatus: row.payment_status ?? null,
    paymentCompletedAt: row.payment_completed_at
      ? Date.parse(row.payment_completed_at)
      : undefined,
  };
}

function getStatusMessage(status: RideRow["status"]): string {
  switch (status) {
    case "searching":
      return "We are searching for the best nearby driver for your trip.";
    case "collecting_offers":
      return "Your request is open. Available drivers can now send offers.";
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
    case "offers_expired":
      return "Driver offers expired. You can send the request again or cancel.";
    default:
      return status;
  }
}


function formatRouteSource(source?: RideRow["route_source"]) {
  switch (source) {
    case "osrm":
      return "OSRM road route";
    case "fallback":
      return "Fallback estimate";
    default:
      return "Not recorded";
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function getPiPaymentIdentifier(payment: unknown): string | null {
  if (!payment || typeof payment !== "object") {
    return null;
  }

  const possiblePayment = payment as {
    identifier?: unknown;
    paymentId?: unknown;
    id?: unknown;
  };

  if (typeof possiblePayment.identifier === "string") {
    return possiblePayment.identifier;
  }

  if (typeof possiblePayment.paymentId === "string") {
    return possiblePayment.paymentId;
  }

  if (typeof possiblePayment.id === "string") {
    return possiblePayment.id;
  }

  return null;
}

function isRidePaid(row: RideRow | null): boolean {
  const snapshot = getPaymentSnapshot(row);

  return Boolean(
    snapshot.payment_status === "completed" ||
      snapshot.payment_completed_at
  );
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

  useEffect(() => {
    if (
      !rideRow ||
      rideRow.status !== "collecting_offers" ||
      !rideRow.offer_expires_at
    ) {
      return;
    }

    const rideIdForExpiry = rideRow.id;
    const expiresAt = Date.parse(rideRow.offer_expires_at);

    if (!Number.isFinite(expiresAt)) {
      return;
    }

    let cancelled = false;

    async function expireOfferWindow() {
      try {
        const updatedRide = await expireRideDriverOfferWindow(rideIdForExpiry);

        if (!cancelled) {
          setRideRow(updatedRide);
        }
      } catch (error) {
        console.error("Failed to expire ride driver offer window:", error);
      }
    }

    const delayMs = Math.max(0, expiresAt - Date.now() + 750);
    const timeoutId = window.setTimeout(() => {
      void expireOfferWindow();
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [rideRow?.id, rideRow?.offer_expires_at, rideRow?.status]);

  const payablePi = useMemo(() => {
    if (!ride) {
      return 0;
    }

    return ride.pricePi;
  }, [ride]);

  const piSession = useMemo(() => getStoredPiSession(), []);
  const canRetryDispatch = rideRow?.status === "cancelled";

  const isPaid =
    payment.payment_status === "completed" || Boolean(payment.payment_completed_at);

  const hasBlockchainLinkedPayment =
    Boolean(payment.payment_id && payment.payment_txid) && !isPaid;

  const canRetryPiCompletion =
    Boolean(ride && payment.payment_id && payment.payment_txid) &&
    payment.payment_status === "approved" &&
    !isPaid;

  const canPayWithPi =
    Boolean(ride && piSession) &&
    payablePi > 0 &&
    rideRow?.status === "completed" &&
    !isPaid &&
    !hasBlockchainLinkedPayment;

  async function refreshCurrentRide(): Promise<RideRow | null> {
    if (!rideId) {
      return null;
    }

    const data = await getRideById(rideId);
    setRideRow(data);

    return data;
  }

  async function handleRetryPiCompletion() {
    if (!ride || !payment.payment_id || !payment.payment_txid) {
      return;
    }

    setPaymentLoading(true);
    setErrorMessage("");
    setPaymentMessage("Retrying Pi payment confirmation...");

    try {
      const result = await completePiRidePayment({
        rideId: ride.id,
        paymentId: payment.payment_id,
        txid: payment.payment_txid,
        amountPi: payment.payment_amount_pi ?? payablePi,
      });

      if (result?.pendingVerification) {
        setPaymentMessage(
          "Payment is still pending Pi verification. Do not pay again. Please try confirmation again later."
        );
      } else {
        setPaymentMessage("Payment completed successfully.");
      }

      await refreshCurrentRide();
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Failed to retry Pi payment confirmation."
      );

      setErrorMessage(message);
      setPaymentMessage(
        "Could not confirm the transaction yet. Do not pay again if your wallet shows a transaction ID."
      );
    } finally {
      setPaymentLoading(false);
    }
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

    if (isPaid || payment.payment_completed_at) {
      setPaymentMessage("Payment has already been completed.");
      return;
    }

    if (hasBlockchainLinkedPayment) {
      setPaymentMessage(
        "This payment already has a transaction ID. Do not pay again. Use Retry Pi confirmation."
      );
      return;
    }

    if (rideRow?.status !== "completed") {
      setErrorMessage("Payment is available only after the trip is completed.");
      return;
    }

    if (payablePi <= 0) {
      setErrorMessage("Invalid payment amount.");
      return;
    }

    setPaymentLoading(true);
    setErrorMessage("");
    setPaymentMessage("Preparing Pi payment access...");

    try {
      const paymentLogin = await ensurePiPaymentsScope();
      saveStoredPiSession(paymentLogin.session);

      setPaymentMessage("Preparing a fresh Pi payment attempt...");
      const preparedRide = await prepareRidePiPaymentRetry({
        rideId: ride.id,
        reason: "Starting new Pi payment attempt",
      });

      setRideRow(preparedRide as RideRow);
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
            try {
              setPaymentMessage("Registering Pi payment attempt...");
              await registerRidePiPaymentAttempt({
                rideId: ride.id,
                paymentId,
              });

              setPaymentMessage("Approving payment on TrueGo server...");
              await approvePiRidePayment({
                rideId: ride.id,
                paymentId,
                amountPi: payablePi,
              });

              setPaymentMessage(
                "Payment approved. Waiting for blockchain confirmation..."
              );
              await refreshCurrentRide();
            } catch (error) {
              const message = getErrorMessage(
                error,
                "TrueGo could not approve the Pi payment."
              );

              try {
                await clearRidePiPaymentAttempt({
                  rideId: ride.id,
                  paymentId,
                  reason: message,
                });
                await refreshCurrentRide();
              } catch (clearError) {
                console.error("Failed to reset Pi payment attempt:", clearError);
              }

              setErrorMessage(message);
              setPaymentMessage("Payment attempt was reset. Please try again.");
              setPaymentLoading(false);
            }
          },
          onReadyForServerCompletion: async (paymentId, txid) => {
            try {
              setPaymentMessage("Completing Pi payment...");
              const completeResult = await completePiRidePayment({
                rideId: ride.id,
                paymentId,
                txid,
                amountPi: payablePi,
              });

              if (completeResult?.pendingVerification) {
                setPaymentMessage(
                  "Payment reached the Pi blockchain, but verification is still pending. Do not pay again. Please retry confirmation or refresh this page."
                );
                await refreshCurrentRide();
                return;
              }

              setPaymentMessage("Payment completed successfully.");
              await refreshCurrentRide();
            } catch (error) {
              const message = getErrorMessage(
                error,
                "Pi payment may have completed, but TrueGo could not confirm it."
              );

              setErrorMessage(message);
              setPaymentMessage(
                "Please refresh this page before trying again. Do not pay twice if the wallet shows a completed payment."
              );
              await refreshCurrentRide();
            } finally {
              setPaymentLoading(false);
            }
          },
          onCancel: async (paymentId) => {
            try {
              await clearRidePiPaymentAttempt({
                rideId: ride.id,
                paymentId,
                reason: "User cancelled Pi payment",
              });
              await refreshCurrentRide();
            } catch (error) {
              console.error("Failed to clear cancelled Pi payment:", error);
            }

            setPaymentMessage("Payment was cancelled. You can try again.");
            setPaymentLoading(false);
          },
          onError: async (error, payment) => {
            const message = getErrorMessage(
              error,
              "Pi payment failed, expired, or timed out."
            );

            setPaymentMessage("Checking payment status before retry...");

            try {
              const latestRide = await refreshCurrentRide();

              if (isRidePaid(latestRide)) {
                setPaymentMessage("Payment completed successfully.");
                setPaymentLoading(false);
                return;
              }

              await clearRidePiPaymentAttempt({
                rideId: ride.id,
                paymentId: getPiPaymentIdentifier(payment),
                reason: message,
              });

              await refreshCurrentRide();
              setErrorMessage(message);
              setPaymentMessage("Payment attempt was reset. You can try again.");
            } catch (clearError) {
              const clearMessage = getErrorMessage(
                clearError,
                "Pi payment failed and TrueGo could not reset the attempt."
              );

              setErrorMessage(clearMessage);
              setPaymentMessage(
                "Please refresh the page before trying another payment."
              );
            } finally {
              setPaymentLoading(false);
            }
          },
        }
      );
    } catch (error) {
      const message = getErrorMessage(error, "Pi payment could not start.");
      setErrorMessage(message);
      setPaymentLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={containerStyle()}>
      <ListingReadinessPanel context="rider" compact />

      <div
        style={{
          marginTop: 14,
          padding: 16,
          borderRadius: 18,
          background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
          color: "#ffffff",
          boxShadow: "0 12px 28px rgba(15, 23, 42, 0.18)",
        }}
      >
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
            <div
              style={{
                display: "inline-flex",
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.15)",
                fontSize: 12,
                fontWeight: 900,
                marginBottom: 8,
              }}
            >
              Live ride status
            </div>

            <h1 style={{ margin: 0, fontSize: 26 }}>Track your TrueGo ride</h1>

            <p style={{ marginTop: 8, marginBottom: 0, lineHeight: 1.6 }}>
              {rideRow ? getStatusMessage(rideRow.status) : "Loading ride status..."}
            </p>
          </div>

          {ride ? <StatusBadge status={ride.status} /> : null}
        </div>

        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
          }}
        >
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              background: "rgba(255,255,255,0.12)",
            }}
          >
            <strong>Fare</strong>
            <div style={{ marginTop: 6 }}>{formatPiAmount(payablePi)}</div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 14,
              background: "rgba(255,255,255,0.12)",
            }}
          >
            <strong>Payment</strong>
            <div style={{ marginTop: 6 }}>{formatPaymentStatus(payment.payment_status)}</div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 14,
              background: "rgba(255,255,255,0.12)",
            }}
          >
            <strong>Driver</strong>
            <div style={{ marginTop: 6 }}>{rideRow?.driver_name ?? "Waiting"}</div>
          </div>
        </div>
      </div>
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

        {ride ? <StatusBadge status={ride.status} /> : null}
      </div>

      <div style={sectionStyle()}>
        <p style={{ margin: 0, fontWeight: 600 }}>{rideRow ? getStatusMessage(rideRow.status) : "Loading ride status..."}</p>

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

      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 16,
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          color: "#0369a1",
          lineHeight: 1.6,
          fontSize: 14,
        }}
      >
        <strong>Review flow checkpoint:</strong> the ride status updates in
        real time. Payment appears only after trip completion, and the Pi
        transaction details are shown here after payment succeeds.
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
            <strong>Estimated fare</strong>
            <div style={{ marginTop: 6 }}>{formatPiAmount(payablePi)}</div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Vehicle</strong>
            <div style={{ marginTop: 6 }}>{ride.vehicleType}</div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Route source</strong>
            <div style={{ marginTop: 6 }}>{formatRouteSource(rideRow.route_source)}</div>
          </div>

          <div style={detailItemStyle()}>
            <strong>Driver</strong>
            <div style={{ marginTop: 6 }}>
              {rideRow.driver_name ?? "Not assigned yet"}
            </div>
          </div>
        </div>

        <TrueGoLiveMapCard ride={rideRow} viewer="rider" />
      </div>

      {rideRow.status === "completed" || payment.payment_id ? (
        <div style={sectionStyle()}>
          <h3 style={{ marginTop: 0 }}>Pi payment</h3>

          <div
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 14,
              background: isPaid ? "#ecfdf5" : "#fff7ed",
              border: isPaid ? "1px solid #bbf7d0" : "1px solid #fed7aa",
              color: isPaid ? "#047857" : "#9a3412",
              lineHeight: 1.6,
              fontSize: 14,
            }}
          >
            <strong>Test-Pi payment review note:</strong>{" "}
            {isPaid
              ? "Payment is completed and the transaction reference is available below."
              : "The payment button becomes available after the driver completes the trip."}
          </div>

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
                  : formatPiAmount(payablePi)}
              </div>
            </div>

            {payment.payment_id ? (
              <div style={detailItemStyle()}>
                <strong>Payment ID</strong>
                <div style={{ marginTop: 6, wordBreak: "break-all" }}>
                  {payment.payment_id}
                </div>
              </div>
            ) : null}

            {payment.payment_txid ? (
              <div style={detailItemStyle()}>
                <strong>Transaction ID</strong>
                <div style={{ marginTop: 6, wordBreak: "break-all" }}>
                  {payment.payment_txid}
                </div>
              </div>
            ) : null}

            {payment.payment_completed_at ? (
              <div style={detailItemStyle()}>
                <strong>Completed at</strong>
                <div style={{ marginTop: 6 }}>
                  {new Date(payment.payment_completed_at).toLocaleString()}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {canRetryPiCompletion ? (
        <div style={sectionStyle()}>
          <h3 style={{ marginTop: 0 }}>Pi payment confirmation</h3>

          <div
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 14,
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412",
              lineHeight: 1.6,
              fontSize: 14,
            }}
          >
            Your wallet shows a transaction ID. Do not pay again. Use this
            button to retry server confirmation for the existing transaction.
          </div>

          <button
            type="button"
            onClick={() => {
              void handleRetryPiCompletion();
            }}
            disabled={paymentLoading}
            style={actionButtonStyle("#7c3aed", paymentLoading)}
          >
            {paymentLoading ? "Confirming..." : "Retry Pi confirmation"}
          </button>
        </div>
      ) : null}

      {rideRow?.status === "collecting_offers" ? (
        <RiderIncomingDriverOfferCard
          ride={rideRow}
          onRideUpdated={(updatedRide) => {
            setRideRow(updatedRide);
          }}
        />
      ) : null}

      {rideRow?.status === "no_driver_available" ||
      rideRow?.status === "offers_expired" ? (
        <RiderOfferOutcomeActions
          ride={rideRow}
          onRideUpdated={(updatedRide) => {
            setRideRow(updatedRide);
          }}
        />
      ) : null}

      <div style={sectionStyle()}>
        <RideTimeline ride={ride} />
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 16,
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          color: "#334155",
          lineHeight: 1.6,
          fontSize: 14,
        }}
      >
        <strong>Available rider actions:</strong>{" "}
        {canRetryPiCompletion
          ? "Payment has a transaction ID. Do not pay again. Retry Pi confirmation instead."
          : canPayWithPi
            ? "Your ride is completed. You can now pay safely with Test-Pi."
            : isPaid
              ? "Payment has already been completed."
              : canRetryDispatch
                ? "No driver accepted this ride yet. You can retry dispatch."
                : "Continue monitoring this page while the ride progresses."}
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
