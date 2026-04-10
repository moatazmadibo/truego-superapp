import type { Ride } from "../types/ride";
import { formatTimestamp } from "../utils/ridePresentation";

interface RideTimelineProps {
  ride: Ride;
}

function timelineItemStyle(isDone: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "16px 1fr",
    gap: 12,
    alignItems: "start",
    opacity: isDone ? 1 : 0.6,
  };
}

function dotStyle(isDone: boolean): React.CSSProperties {
  return {
    width: 12,
    height: 12,
    marginTop: 4,
    borderRadius: 999,
    background: isDone ? "#10b981" : "#cbd5e1",
    boxShadow: isDone ? "0 0 0 4px rgba(16, 185, 129, 0.12)" : "none",
  };
}

export default function RideTimeline({ ride }: RideTimelineProps) {
  const steps = [
    {
      key: "created",
      title: "Ride created",
      time: ride.createdAt,
      done: true,
    },
    {
      key: "accepted",
      title: "Driver accepted",
      time: ride.acceptedAt,
      done: ride.status !== "searching",
    },
    {
      key: "started",
      title: "Trip started",
      time: ride.startedAt,
      done: ride.status === "in_progress" || ride.status === "completed",
    },
    {
      key: "completed",
      title: "Trip completed",
      time: ride.completedAt,
      done: ride.status === "completed",
    },
  ];

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 12 }}>Trip timeline</div>

      <div style={{ display: "grid", gap: 12 }}>
        {steps.map((step) => (
          <div key={step.key} style={timelineItemStyle(step.done)}>
            <div style={dotStyle(step.done)} />
            <div>
              <div style={{ fontWeight: 600 }}>{step.title}</div>
              <div style={{ color: "#6b7280", fontSize: 14 }}>
                {formatTimestamp(step.time)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
