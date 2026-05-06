import type { LatLng, VehicleType } from "../types/ride";
import { usdToPiAmount } from "../lib/piPricing";

export interface RouteEstimate {
  pickup: LatLng;
  destination: LatLng;
  distanceKm: number;
  durationMin: number;
  pricePi: number;
  routeSource: "osrm" | "fallback";
}

const BASE_FARE: Record<VehicleType, number> = {
  car: 1.5,
  motorcycle: 1.0,
};

const PER_KM: Record<VehicleType, number> = {
  car: 0.45,
  motorcycle: 0.3,
};

const PER_MIN: Record<VehicleType, number> = {
  car: 0.08,
  motorcycle: 0.05,
};

const nominatimBaseUrl =
  (import.meta.env.VITE_NOMINATIM_BASE_URL as string | undefined) ||
  "https://nominatim.openstreetmap.org";

const osrmBaseUrl =
  (import.meta.env.VITE_OSRM_BASE_URL as string | undefined) ||
  "https://router.project-osrm.org";

function parseLatLng(value: string): LatLng | null {
  const match = value.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/
  );

  if (!match) {
    return null;
  }

  return {
    lat: Number(match[1]),
    lng: Number(match[2]),
  };
}

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

function calculatePrice(
  distanceKm: number,
  durationMin: number,
  vehicleType: VehicleType
): number {
  const referenceFare =
    BASE_FARE[vehicleType] +
    distanceKm * PER_KM[vehicleType] +
    durationMin * PER_MIN[vehicleType];

  return usdToPiAmount(referenceFare);
}

async function geocodeLocation(
  text: string,
  fallback: LatLng
): Promise<LatLng> {
  const directCoordinates = parseLatLng(text);

  if (directCoordinates) {
    return directCoordinates;
  }

  try {
    const url =
      `${nominatimBaseUrl}/search?format=jsonv2&limit=1&q=` +
      encodeURIComponent(text);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return fallback;
    }

    const data = (await response.json()) as Array<{ lat: string; lon: string }>;

    const firstResult = data[0];

    if (!firstResult) {
      return fallback;
    }

    return {
      lat: Number(firstResult.lat),
      lng: Number(firstResult.lon),
    };
  } catch {
    return fallback;
  }
}

async function getRouteMetrics(
  pickup: LatLng,
  destination: LatLng
): Promise<{
  distanceKm: number;
  durationMin: number;
  source: RouteEstimate["routeSource"];
}> {
  try {
    const url =
      `${osrmBaseUrl}/route/v1/driving/` +
      `${pickup.lng},${pickup.lat};${destination.lng},${destination.lat}` +
      `?overview=false`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("OSRM request failed");
    }

    const data = (await response.json()) as {
      routes?: Array<{ distance: number; duration: number }>;
    };

    const route = data.routes?.[0];

    if (!route) {
      throw new Error("No route found");
    }

    return {
      distanceKm: Number((route.distance / 1000).toFixed(2)),
      durationMin: Math.max(1, Math.ceil(route.duration / 60)),
      source: "osrm",
    };
  } catch {
    const distanceKm = Number(haversineDistanceKm(pickup, destination).toFixed(2));
    const durationMin = Math.max(5, Math.ceil((distanceKm / 35) * 60));

    return {
      distanceKm,
      durationMin,
      source: "fallback",
    };
  }
}

export async function calculateRouteEstimateByText(
  pickupText: string,
  destinationText: string,
  vehicleType: VehicleType
): Promise<RouteEstimate> {
  const pickupFallback: LatLng = { lat: 30.0444, lng: 31.2357 };
  const destinationFallback: LatLng = { lat: 30.0595, lng: 31.2230 };

  const [pickup, destination] = await Promise.all([
    geocodeLocation(pickupText, pickupFallback),
    geocodeLocation(destinationText, destinationFallback),
  ]);

  return calculateRouteEstimate(pickup, destination, vehicleType);
}

export async function calculateRouteEstimate(
  pickup: LatLng,
  destination: LatLng,
  vehicleType: VehicleType
): Promise<RouteEstimate> {
  const metrics = await getRouteMetrics(pickup, destination);

  return {
    pickup,
    destination,
    distanceKm: metrics.distanceKm,
    durationMin: metrics.durationMin,
    pricePi: calculatePrice(
      metrics.distanceKm,
      metrics.durationMin,
      vehicleType
    ),
    routeSource: metrics.source,
  };
}