import type { Driver, Ride, RideStatus } from "../types/ride";

const DRIVERS_KEY = "truego_drivers";
const RIDES_KEY = "truego_rides";

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);

  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function seedDrivers(): void {
  const existingDrivers = readJson<Driver[]>(DRIVERS_KEY, []);

  if (existingDrivers.length > 0) {
    return;
  }

  const drivers: Driver[] = [
    {
      id: "d1",
      name: "Ahmed",
      lat: 30.045,
      lng: 31.235,
      vehicleType: "car",
      isAvailable: true,
      rating: 4.8,
    },
    {
      id: "d2",
      name: "Mohamed",
      lat: 30.052,
      lng: 31.242,
      vehicleType: "car",
      isAvailable: true,
      rating: 4.7,
    },
    {
      id: "d3",
      name: "Ali",
      lat: 30.040,
      lng: 31.228,
      vehicleType: "motorcycle",
      isAvailable: true,
      rating: 4.9,
    },
  ];

  writeJson(DRIVERS_KEY, drivers);
}

export function getDrivers(): Driver[] {
  return readJson<Driver[]>(DRIVERS_KEY, []);
}

export function getDriverById(driverId: string): Driver | null {
  return getDrivers().find((driver) => driver.id === driverId) ?? null;
}

export function saveDrivers(drivers: Driver[]): void {
  writeJson(DRIVERS_KEY, drivers);
}

export function getRides(): Ride[] {
  return readJson<Ride[]>(RIDES_KEY, []);
}

export function saveRides(rides: Ride[]): void {
  writeJson(RIDES_KEY, rides);
}

export function addRide(ride: Ride): Ride {
  const rides = getRides();
  rides.unshift(ride);
  saveRides(rides);
  return ride;
}

export function assignDriverToRide(rideId: string, driverId: string): Ride | null {
  const rides = getRides();
  const updatedRides = rides.map((ride) => {
    if (ride.id !== rideId) {
      return ride;
    }

    return {
      ...ride,
      driverId,
      status: "driver_assigned" as const,
    };
  });

  saveRides(updatedRides);

  const updatedDrivers = getDrivers().map((driver) => {
    if (driver.id !== driverId) {
      return driver;
    }

    return {
      ...driver,
      isAvailable: false,
    };
  });

  saveDrivers(updatedDrivers);

  return updatedRides.find((ride) => ride.id === rideId) ?? null;
}

export function updateRideStatus(rideId: string, status: RideStatus): Ride | null {
  const rides = getRides();
  let updatedRide: Ride | null = null;

  const updatedRides = rides.map((ride) => {
    if (ride.id !== rideId) {
      return ride;
    }

    updatedRide = {
      ...ride,
      status,
      acceptedAt: status === "driver_arriving" ? Date.now() : ride.acceptedAt,
      startedAt: status === "in_progress" ? Date.now() : ride.startedAt,
      completedAt: status === "completed" ? Date.now() : ride.completedAt,
    };

    return updatedRide;
  });

  saveRides(updatedRides);

  if (status === "completed" && updatedRide?.driverId) {
    releaseDriver(updatedRide.driverId);
  }

  return updatedRide;
}

export function releaseDriver(driverId: string): void {
  const updatedDrivers = getDrivers().map((driver) => {
    if (driver.id !== driverId) {
      return driver;
    }

    return {
      ...driver,
      isAvailable: true,
    };
  });

  saveDrivers(updatedDrivers);
}

export function getRideById(rideId: string): Ride | null {
  return getRides().find((ride) => ride.id === rideId) ?? null;
}

export function getActiveRideForDriver(driverId: string): Ride | null {
  return (
    getRides().find(
      (ride) =>
        ride.driverId === driverId &&
        (ride.status === "driver_assigned" ||
          ride.status === "driver_arriving" ||
          ride.status === "in_progress")
    ) ?? null
  );
}