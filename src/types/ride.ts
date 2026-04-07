export type RideStatus =
  | "searching"
  | "driver_assigned"
  | "driver_arriving"
  | "in_progress"
  | "completed"
  | "cancelled";

export type VehicleType = "car" | "motorcycle";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Driver {
  id: string;
  name: string;
  lat: number;
  lng: number;
  vehicleType: VehicleType;
  isAvailable: boolean;
  rating: number;
}

export interface Ride {
  id: string;
  riderId: string;
  driverId?: string;
  pickupText: string;
  destinationText: string;
  pickup: LatLng;
  destination: LatLng;
  distanceKm: number;
  durationMin: number;
  pricePi: number;
  vehicleType: VehicleType;
  status: RideStatus;
  createdAt: number;
  acceptedAt?: number;
  startedAt?: number;
  completedAt?: number;
}