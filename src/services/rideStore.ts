export type RideStage =
  | "searching"
  | "driver_assigned"
  | "driver_arriving"
  | "in_progress"
  | "completed";

export interface RideRecord {
  id: string;
  pickup: string;
  destination: string;
  distance: number;
  duration: number;
  price: number;
  driverName: string;
  stage: RideStage;
  createdAt: number;
}

const STORAGE_KEY = "truego_active_ride";

export function saveRide(ride: RideRecord): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ride));
}

export function getRide(): RideRecord | null {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as RideRecord;
  } catch {
    return null;
  }
}

export function updateRideStage(stage: RideStage): RideRecord | null {
  const current = getRide();

  if (!current) {
    return null;
  }

  const updated: RideRecord = {
    ...current,
    stage,
  };

  saveRide(updated);
  return updated;
}

export function clearRide(): void {
  localStorage.removeItem(STORAGE_KEY);
}