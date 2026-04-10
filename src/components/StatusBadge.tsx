import type { RideStatus } from "../types/ride";
import { getRideStatusColor, getRideStatusLabel } from "../utils/ridePresentation";

interface StatusBadgeProps {
  status: RideStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <div
      style={{
        display: "inline-block",
        padding: "6px 12px",
        borderRadius: 999,
        background: getRideStatusColor(status),
        color: "#ffffff",
        marginBottom: 12,
        fontWeight: 600,
      }}
    >
      {getRideStatusLabel(status)}
    </div>
  );
}
