import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { formatPiAmount } from "../../lib/piPricing";
import {
  acceptRideDriverOffer,
  expireRideDriverOfferWindow,
  listRideDriverOffers,
  rejectRideDriverOffer,
  type RideDriverOfferRow,
  type RideRow,
} from "../../services/rideApi";

function cardStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)",
  };
}

function avatarStyle(): React.CSSProperties {
  return {
    width: 72,
    height: 72,
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid #ede9fe",
    background: "#f3f4f6",
  };
}

function buttonStyle(background: string, disabled = false): React.CSSProperties {
  return {
    border: 0,
    borderRadius: 14,
    padding: "13px 16px",
    color: "#ffffff",
    background,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    flex: "1 1 140px",
  };
}

function detailPillStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    background: "#f3f4f6",
    color: "#374151",
    fontWeight: 700,
    fontSize: 13,
  };
}

function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function countdownPillStyle(secondsRemaining: number | null): React.CSSProperties {
  const isEndingSoon = secondsRemaining != null && secondsRemaining <= 15;

  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "8px 12px",
    background: isEndingSoon ? "#fef2f2" : "#eef2ff",
    color: isEndingSoon ? "#b91c1c" : "#3730a3",
    fontWeight: 900,
    fontSize: 13,
    border: isEndingSoon ? "1px solid #fecaca" : "1px solid #c7d2fe",
  };
}

export default function RiderIncomingDriverOfferCard({
  ride,
  onRideUpdated,
}: {
  ride: RideRow;
  onRideUpdated: (ride: RideRow) => void;
}) {
  const [offers, setOffers] = useState<RideDriverOfferRow[]>([]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  const activeOffer = offers[0] ?? null;

  useEffect(() => {
    if (ride.status !== "collecting_offers" || !ride.offer_expires_at) {
      setSecondsRemaining(null);
      return;
    }

    const expiresAt = Date.parse(ride.offer_expires_at);

    if (!Number.isFinite(expiresAt)) {
      setSecondsRemaining(null);
      return;
    }

    function tick() {
      setSecondsRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    }

    tick();

    const intervalId = window.setInterval(tick, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [ride.offer_expires_at, ride.status]);

  async function loadOffers() {
    if (ride.status !== "collecting_offers") {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const rows = await listRideDriverOffers(ride.id);
      setOffers(rows);
    } catch (loadError) {
      const text =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load driver offers.";
      setError(text);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOffers();

    const intervalId = window.setInterval(() => {
      void loadOffers();
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [ride.id, ride.status]);

  useEffect(() => {
    if (ride.status !== "collecting_offers" || !ride.offer_expires_at) {
      return;
    }

    const rideIdForExpiry = ride.id;
    const expiresAt = Date.parse(ride.offer_expires_at);

    if (!Number.isFinite(expiresAt)) {
      return;
    }

    let cancelled = false;
    let expiryInProgress = false;

    async function expireIfNeeded() {
      if (cancelled || expiryInProgress || Date.now() < expiresAt + 750) {
        return;
      }

      expiryInProgress = true;
      setError("");

      try {
        const updatedRide = await expireRideDriverOfferWindow(rideIdForExpiry);

        if (!cancelled) {
          onRideUpdated(updatedRide);
        }
      } catch (expiryError) {
        const text =
          expiryError instanceof Error
            ? expiryError.message
            : "Failed to expire driver offer window.";

        if (!cancelled) {
          setError(text);
        }

        console.error("Failed to expire driver offer window from rider offer card:", expiryError);
      } finally {
        expiryInProgress = false;
      }
    }

    void expireIfNeeded();

    const intervalId = window.setInterval(() => {
      void expireIfNeeded();
    }, 3000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void expireIfNeeded();
      }
    };

    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [ride.id, ride.offer_expires_at, ride.status, onRideUpdated]);

  useEffect(() => {
    let cancelled = false;

    async function loadPhoto() {
      setPhotoUrl("");

      if (!activeOffer?.driver_photo_path) {
        return;
      }

      const { data, error: signedUrlError } = await supabase.storage
        .from("driver-documents")
        .createSignedUrl(activeOffer.driver_photo_path, 3600);

      if (!cancelled && !signedUrlError && data?.signedUrl) {
        setPhotoUrl(data.signedUrl);
      }
    }

    void loadPhoto();

    return () => {
      cancelled = true;
    };
  }, [activeOffer?.id, activeOffer?.driver_photo_path]);

  async function handleAccept() {
    if (!activeOffer) {
      return;
    }

    if (secondsRemaining != null && secondsRemaining <= 0) {
      setError("This offer window has expired. Please resend the ride request.");
      return;
    }

    setActionLoading("accept");
    setError("");
    setMessage("");

    try {
      const updatedRide = await acceptRideDriverOffer(activeOffer.id);
      setOffers([]);
      setMessage("Driver offer accepted.");
      onRideUpdated(updatedRide);
    } catch (acceptError) {
      const text =
        acceptError instanceof Error
          ? acceptError.message
          : "Failed to accept driver offer.";
      setError(text);
    } finally {
      setActionLoading("");
    }
  }

  async function handleReject() {
    if (!activeOffer) {
      return;
    }

    setActionLoading("reject");
    setError("");
    setMessage("");

    try {
      await rejectRideDriverOffer(activeOffer.id);
      setMessage("Offer rejected. Waiting for the next driver offer...");
      await loadOffers();
    } catch (rejectError) {
      const text =
        rejectError instanceof Error
          ? rejectError.message
          : "Failed to reject driver offer.";
      setError(text);
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div style={cardStyle()}>
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
          <h2 style={{ margin: 0 }}>Incoming driver offers</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.6 }}>
            Drivers can accept your suggested fare or submit a counter-offer.
            Review each offer and choose the best one.
          </p>
        </div>

        <span
          style={{
            borderRadius: 999,
            padding: "8px 12px",
            background: "#7c3aed",
            color: "#ffffff",
            fontWeight: 900,
            fontSize: 13,
          }}
        >
          Collecting offers
        </span>

        {secondsRemaining != null ? (
          <span style={countdownPillStyle(secondsRemaining)}>
            Closes in {formatCountdown(secondsRemaining)}
          </span>
        ) : null}
      </div>

      {loading && offers.length === 0 ? (
        <p style={{ color: "#64748b" }}>Waiting for driver offers...</p>
      ) : null}

      {!loading && offers.length === 0 ? (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 16,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            lineHeight: 1.6,
          }}
        >
          No driver offer has arrived yet. Keep this page open while available
          drivers review your request.
        </div>
      ) : null}

      {activeOffer ? (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 20,
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {photoUrl ? (
              <img src={photoUrl} alt={activeOffer.driver_name} style={avatarStyle()} />
            ) : (
              <div
                style={{
                  ...avatarStyle(),
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 900,
                  color: "#7c3aed",
                  fontSize: 24,
                }}
              >
                {activeOffer.driver_name.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div style={{ flex: "1 1 220px" }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>
                {activeOffer.driver_name}
              </div>

              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={detailPillStyle()}>
                  ⭐ {activeOffer.driver_rating?.toFixed(1) ?? "N/A"}
                </span>

                <span style={detailPillStyle()}>
                  {[
                    activeOffer.vehicle_color,
                    activeOffer.vehicle_make,
                    activeOffer.vehicle_model,
                    activeOffer.vehicle_year,
                  ]
                    .filter(Boolean)
                    .join(" ") || activeOffer.vehicle_type || "Vehicle"}
                </span>

                {activeOffer.vehicle_plate ? (
                  <span style={detailPillStyle()}>
                    Plate {activeOffer.vehicle_plate}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 16,
              background: "#ffffff",
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ color: "#64748b", fontWeight: 800 }}>Offer price</div>
            <div style={{ fontSize: 30, fontWeight: 900, marginTop: 4 }}>
              {formatPiAmount(Number(activeOffer.offer_price_pi))}
            </div>

            <div style={{ marginTop: 8, color: "#64748b" }}>
              Your suggested fare:{" "}
              <strong>{formatPiAmount(Number(activeOffer.rider_initial_price_pi))}</strong>
            </div>

            {activeOffer.eta_minutes ? (
              <div style={{ marginTop: 8, color: "#64748b" }}>
                ETA: <strong>~{activeOffer.eta_minutes} min</strong>
              </div>
            ) : null}

            {activeOffer.driver_note ? (
              <div style={{ marginTop: 8, color: "#334155" }}>
                “{activeOffer.driver_note}”
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                void handleAccept();
              }}
              disabled={Boolean(actionLoading)}
              style={buttonStyle("#16a34a", Boolean(actionLoading))}
            >
              {actionLoading === "accept" ? "Accepting..." : "Accept"}
            </button>

            <button
              type="button"
              onClick={() => {
                void handleReject();
              }}
              disabled={Boolean(actionLoading)}
              style={buttonStyle("#dc2626", Boolean(actionLoading))}
            >
              {actionLoading === "reject" ? "Rejecting..." : "Reject"}
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "#ecfdf5",
            border: "1px solid #bbf7d0",
            color: "#047857",
          }}
        >
          {message}
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
