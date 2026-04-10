import type { RideStatus } from "../types/ride";

export function getRideStatusLabel(status: RideStatus): string {
  switch (status) {
    case "searching":
      return "Searching for driver";
    case "driver_assigned":
      return "Driver assigned";
    case "driver_arriving":
      return "Driver is arriving";
    case "in_progress":
      return "Ride in progress";
    case "completed":
      return "Ride completed";
    case "cancelled":
      return "Ride cancelled";
    default:
      return status;
  }
}

export function getRideStatusColor(status: RideStatus): string {
  switch (status) {
    case "searching":
      return "#f59e0b";
    case "driver_assigned":
      return "#2563eb";
    case "driver_arriving":
      return "#0ea5e9";
    case "in_progress":
      return "#8b5cf6";
    case "completed":
      return "#10b981";
    case "cancelled":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

export function formatTimestamp(timestamp?: number): string {
  if (!timestamp) {
    return "Pending";
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
