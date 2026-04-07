import type { Driver, LatLng, Ride, VehicleType } from "../types/ride";
import {
  addRide,
  assignDriverToRide,
  getDrivers,
  seedDrivers,
} from "./mockRealtimeStore";

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const earthRadiusKm = 6371;

  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);

  const part =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const arc = 2 * Math.atan2(Math.sqrt(part), Math.sqrt(1 - part));

  return earthRadiusKm * arc;
}

export function findNearestAvailableDriver(
  pickup: LatLng,
  vehicleType: VehicleType
): Driver | null {
  seedDrivers();

  const availableDrivers = getDrivers().filter(
    (driver) => driver.isAvailable && driver.vehicleType === vehicleType
  );

  if (availableDrivers.length === 0) {
    return null;
  }

  const sortedDrivers = [...availableDrivers].sort((a, b) => {
    const distanceA = haversineDistanceKm(pickup, { lat: a.lat, lng: a.lng });
    const distanceB = haversineDistanceKm(pickup, { lat: b.lat, lng: b.lng });

    return distanceA - distanceB;
  });

  return sortedDrivers[0] ?? null;
}

export function createRideAndMatch(ride: Ride): {
  ride: Ride;
  driver: Driver | null;
} {
  addRide(ride);

  const driver = findNearestAvailableDriver(ride.pickup, ride.vehicleType);

  if (!driver) {
    return {
      ride,
      driver: null,
    };
  }

  const updatedRide = assignDriverToRide(ride.id, driver.id) ?? ride;

  return {
    ride: updatedRide,
    driver,
  };
}