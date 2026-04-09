const DRIVER_SESSION_KEY = "truego_selected_driver_id";

export function getSelectedDriverId(): string {
  return localStorage.getItem(DRIVER_SESSION_KEY) ?? "";
}

export function setSelectedDriverId(driverId: string): void {
  localStorage.setItem(DRIVER_SESSION_KEY, driverId);
}

export function clearSelectedDriverId(): void {
  localStorage.removeItem(DRIVER_SESSION_KEY);
}
