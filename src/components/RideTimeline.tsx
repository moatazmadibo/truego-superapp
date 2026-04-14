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
        <div style={{ fontWeight: 600, color: active ? "#111827" : "#6b7280" }}>
          {label}
        </div>
        <div style={{ color: "#6b7280", fontSize: 14 }}>{timeLabel}</div>
      </div>
    </div>
  );
}

export default function RideTimeline({ ride }: RideTimelineProps) {
  const offerSentActive = isActive(ride.status, [
    "offer_sent",
    "driver_assigned",
    "driver_arriving",
    "in_progress",
    "completed",
  ]);

  const acceptedActive = isActive(ride.status, [
    "driver_assigned",
    "driver_arriving",
    "in_progress",
    "completed",
  ]);

  const startedActive = isActive(ride.status, ["in_progress", "completed"]);
  const completedActive = ride.status === "completed";
  const noDriverAvailable = ride.status === "no_driver_available";

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
        label="Ride created"
        active
        timeLabel={formatTimestamp(ride.createdAt)}
      />

      <TimelineItem
        label="Offer sent to driver"
        active={offerSentActive}
        timeLabel={
          offerSentActive
            ? ride.status === "offer_sent"
              ? "Waiting for driver response"
              : "Offer processed"
            : "Pending"
        }
      />

      <TimelineItem
        label="Driver accepted"
        active={acceptedActive}
        timeLabel={acceptedActive ? formatTimestamp(ride.acceptedAt) : "Pending"}
      />

      <TimelineItem
        label="Trip started"
        active={startedActive}
        timeLabel={startedActive ? formatTimestamp(ride.startedAt) : "Pending"}
      />

      <TimelineItem
        label="Trip completed"
        active={completedActive}
        timeLabel={completedActive ? formatTimestamp(ride.completedAt) : "Pending"}
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
            fontWeight: 600,
          }}
        >
          No driver accepted the request within the search window.
        </div>
      ) : null}
    </div>
  );
}
