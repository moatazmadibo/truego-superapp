import type { Ride } from "../types/ride";

type RideTimelineProps = {
  ride: Ride;
};

function isActive(current: Ride["status"], statuses: Ride["status"][]) {
  return statuses.includes(current);
}

function formatTimestamp(value?: number) {
  if (!value) {
    return "Pending";
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function TimelineItem({
  label,
  active,
  timeLabel,
}: {
  label: string;
  active: boolean;
  timeLabel: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          marginTop: 6,
          background: active ? "#10b981" : "#d1d5db",
          flexShrink: 0,
        }}
      />
      <div>
        <div style={{ fontWeight: 700, color: active ? "#111827" : "#6b7280" }}>
          {label}
        </div>
        <div style={{ color: "#6b7280", fontSize: 14, marginTop: 2 }}>
          {timeLabel}
        </div>
      </div>
    </div>
  );
}

export default function RideTimeline({ ride }: RideTimelineProps) {
  const requestSentActive = isActive(ride.status, [
    "collecting_offers",
    "offer_sent",
    "driver_assigned",
    "driver_arriving",
    "in_progress",
    "completed",
    "offers_expired",
    "no_driver_available",
  ]);

  const offersReceivedActive = isActive(ride.status, [
    "collecting_offers",
    "driver_assigned",
    "driver_arriving",
    "in_progress",
    "completed",
  ]);

  const riderSelectedOfferActive = isActive(ride.status, [
    "driver_assigned",
    "driver_arriving",
    "in_progress",
    "completed",
  ]);

  const driverArrivingActive = isActive(ride.status, [
    "driver_arriving",
    "in_progress",
    "completed",
  ]);

  const tripInProgressActive = isActive(ride.status, ["in_progress", "completed"]);
  const tripCompletedActive = ride.status === "completed";

  const paymentCompletedActive =
    ride.paymentStatus === "completed" || Boolean(ride.paymentCompletedAt);

  const noDriverAvailable = ride.status === "no_driver_available";
  const offersExpired = ride.status === "offers_expired";

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 16,
        background: "#fff",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 18 }}>Trip timeline</h3>

      <TimelineItem
        label="Request created"
        active
        timeLabel={formatTimestamp(ride.createdAt)}
      />

      <TimelineItem
        label="Request sent to drivers"
        active={requestSentActive}
        timeLabel={
          requestSentActive
            ? ride.status === "collecting_offers"
              ? "Collecting driver offers"
              : ride.status === "offer_sent"
                ? "Waiting for driver response"
                : "Request processed"
            : "Pending"
        }
      />

      <TimelineItem
        label="Driver offers received"
        active={offersReceivedActive}
        timeLabel={
          offersReceivedActive
            ? ride.status === "collecting_offers"
              ? "Review incoming offers"
              : "Offer received"
            : "Pending"
        }
      />

      <TimelineItem
        label="Rider selected offer"
        active={riderSelectedOfferActive}
        timeLabel={
          riderSelectedOfferActive
            ? formatTimestamp(ride.acceptedAt)
            : "Pending"
        }
      />

      <TimelineItem
        label="Driver arriving"
        active={driverArrivingActive}
        timeLabel={
          driverArrivingActive
            ? ride.status === "driver_arriving"
              ? "Driver is on the way"
              : "Driver arrived / trip progressed"
            : "Pending"
        }
      />

      <TimelineItem
        label="Trip in progress"
        active={tripInProgressActive}
        timeLabel={
          tripInProgressActive ? formatTimestamp(ride.startedAt) : "Pending"
        }
      />

      <TimelineItem
        label="Trip completed"
        active={tripCompletedActive}
        timeLabel={
          tripCompletedActive ? formatTimestamp(ride.completedAt) : "Pending"
        }
      />

      <TimelineItem
        label="Pi payment completed"
        active={paymentCompletedActive}
        timeLabel={
          paymentCompletedActive
            ? formatTimestamp(ride.paymentCompletedAt)
            : "Pending"
        }
      />

      {noDriverAvailable ? (
        <div
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontWeight: 700,
            lineHeight: 1.6,
          }}
        >
          No driver responded to the rider&apos;s initial fare. The rider can
          increase the offer and send the request again.
        </div>
      ) : null}

      {offersExpired ? (
        <div
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            fontWeight: 700,
            lineHeight: 1.6,
          }}
        >
          Driver offers expired without rider selection. The rider can resend
          the request or cancel the ride.
        </div>
      ) : null}
    </div>
  );
}
