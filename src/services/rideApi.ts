import { supabase } from "../lib/supabase";

export type VehicleType = "car" | "motorcycle";

export type RideStage =
  | "searching"
  | "collecting_offers"
  | "offer_sent"
  | "driver_assigned"
  | "driver_arriving"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_driver_available"
  | "offers_expired";

export interface RideRow {
  id: string;
  rider_user_id: string | null;
  rider_name: string | null;
  driver_user_id: string | null;
  driver_name: string | null;
  demo_driver_id: string | null;
  offered_demo_driver_id: string | null;
  offer_expires_at: string | null;
  pickup_text: string;
  destination_text: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  distance_km: number;
  duration_min: number;
  price_pi: number;
  route_source: "osrm" | "fallback" | null;
  driver_payout_pi: number | null;
  pricing_breakdown: Record<string, unknown> | null;
  vehicle_type: VehicleType;
  status: RideStage;
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  payment_status?: "unpaid" | "approved" | "completed" | "cancelled" | "failed" | null;
  payment_provider?: string | null;
  payment_id?: string | null;
  payment_txid?: string | null;
  payment_amount_pi?: number | null;
  payment_completed_at?: string | null;
  payment_attempt_count?: number | null;
  payment_last_error?: string | null;
  payment_last_error_at?: string | null;
}

export type RideDriverOfferStatus =
  | "submitted"
  | "shown"
  | "accepted"
  | "rejected"
  | "expired"
  | "withdrawn";

export interface RideDriverOfferRow {
  id: string;
  ride_id: string;
  demo_driver_id: string;
  driver_name: string;
  driver_rating: number | null;
  driver_photo_path: string | null;
  vehicle_type: VehicleType | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
  rider_initial_price_pi: number;
  offer_price_pi: number;
  eta_minutes: number | null;
  driver_note: string | null;
  offer_status: RideDriverOfferStatus;
  shown_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemoDriverRow {
  id: string;
  display_name: string;
  vehicle_type: VehicleType;
  is_available: boolean;
  is_online: boolean;
  rating: number;
  lat: number | null;
  lng: number | null;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string | null;
  heading: number | null;
  speed_kph: number | null;
  last_seen_at: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
  vehicle_year: number | null;
  vehicle_license_expires_at: string | null;
  driver_license_expires_at: string | null;
  profile_photo_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRideInput {
  rider_user_id?: string | null;
  rider_name?: string | null;
  driver_user_id?: string | null;
  driver_name?: string | null;
  pickup_text: string;
  destination_text: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  distance_km: number;
  duration_min: number;
  price_pi: number;
  route_source?: "osrm" | "fallback" | null;
  driver_payout_pi?: number | null;
  pricing_breakdown?: Record<string, unknown> | null;
  vehicle_type: VehicleType;
  status?: RideStage;
}

export interface RidePricingQuote {
  quotedPricePi: number;
  driverPayoutPi: number;
  breakdown: Record<string, unknown>;
}

function roundPi(value: number): number {
  return Math.round(value * 100) / 100;
}

export function quoteRidePricing(
  input: Pick<CreateRideInput, "distance_km" | "duration_min" | "vehicle_type">,
  requestedAt = new Date()
): RidePricingQuote {
  const hour = requestedAt.getHours();

  const baseFare = input.vehicle_type === "motorcycle" ? 0.35 : 0.6;
  const perKmRate = input.vehicle_type === "motorcycle" ? 0.12 : 0.2;
  const perMinRate = input.vehicle_type === "motorcycle" ? 0.03 : 0.05;
  const minimumFare = input.vehicle_type === "motorcycle" ? 0.75 : 1.1;

  const isPeak = (hour >= 7 && hour < 10) || (hour >= 16 && hour < 20);
  const isNight = hour >= 22 || hour < 6;

  const peakMultiplier = isPeak ? 1.2 : 1;
  const nightMultiplier = isNight ? 1.1 : 1;
  const demandMultiplier = 1;
  const serviceFee = input.vehicle_type === "motorcycle" ? 0.08 : 0.12;

  const rawFare =
    (baseFare + input.distance_km * perKmRate + input.duration_min * perMinRate) *
    peakMultiplier *
    nightMultiplier *
    demandMultiplier;

  const quotedPricePi = roundPi(Math.max(minimumFare, rawFare) + serviceFee);
  const driverPayoutPi = roundPi(quotedPricePi * 0.85);

  return {
    quotedPricePi,
    driverPayoutPi,
    breakdown: {
      baseFare,
      perKmRate,
      perMinRate,
      distanceKm: input.distance_km,
      durationMin: input.duration_min,
      minimumFare,
      peakMultiplier,
      nightMultiplier,
      demandMultiplier,
      serviceFee,
      vehicleType: input.vehicle_type,
      requestedHour: hour,
    },
  };
}

export async function createRide(input: CreateRideInput): Promise<RideRow> {
  const { data, error } = await supabase
    .from("rides")
    .insert({
      rider_user_id: input.rider_user_id ?? null,
      rider_name: input.rider_name ?? "Rider",
      driver_user_id: input.driver_user_id ?? null,
      driver_name: input.driver_name ?? null,
      pickup_text: input.pickup_text,
      destination_text: input.destination_text,
      pickup_lat: input.pickup_lat ?? null,
      pickup_lng: input.pickup_lng ?? null,
      destination_lat: input.destination_lat ?? null,
      destination_lng: input.destination_lng ?? null,
      distance_km: input.distance_km,
      duration_min: input.duration_min,
      price_pi: input.price_pi,
      route_source: input.route_source ?? null,
      driver_payout_pi: input.driver_payout_pi ?? null,
      pricing_breakdown: input.pricing_breakdown ?? null,
      vehicle_type: input.vehicle_type,
      status: input.status ?? "searching",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as RideRow;
}

export async function dispatchRideToNearestDemoDriver(
  rideId: string,
  presenceWindowSeconds = 90
): Promise<RideRow> {
  const { data, error } = await supabase.rpc(
    "dispatch_ride_to_nearest_demo_driver",
    {
      p_ride_id: rideId,
      p_presence_window_seconds: presenceWindowSeconds,
    }
  );

  if (error) {
    throw error;
  }

  return data as RideRow;
}

export async function syncDemoRideOfferState(
  rideId: string
): Promise<RideRow> {
  const { data, error } = await supabase.rpc("sync_demo_ride_offer_state", {
    p_ride_id: rideId,
  });

  if (error) {
    throw error;
  }

  return data as RideRow;
}

export async function declineOfferedDemoRide(
  rideId: string,
  driverId: string
): Promise<RideRow> {
  const { data, error } = await supabase.rpc("decline_offered_demo_ride", {
    p_ride_id: rideId,
    p_driver_id: driverId,
  });

  if (error) {
    throw error;
  }

  return data as RideRow;
}

export async function retryDemoRideDispatch(
  rideId: string
): Promise<RideRow> {
  const { data, error } = await supabase.rpc("retry_demo_ride_dispatch", {
    p_ride_id: rideId,
  });

  if (error) {
    throw error;
  }

  return data as RideRow;
}

export async function createRideAndAutoDispatch(
  input: CreateRideInput,
  presenceWindowSeconds = 90
): Promise<RideRow> {
  const riderFarePi = Number(input.price_pi.toFixed(8));
  const driverPayoutPi = Number((riderFarePi * 0.85).toFixed(8));

  const ride = await createRide({
    ...input,
    price_pi: riderFarePi,
    driver_payout_pi: input.driver_payout_pi ?? driverPayoutPi,
    pricing_breakdown: input.pricing_breakdown ?? {
      riderFarePi,
      driverPayoutPi,
      driverPayoutRate: 0.85,
      vehicleType: input.vehicle_type,
      distanceKm: input.distance_km,
      durationMin: input.duration_min,
      pricingMode: "fractional_test_pi",
    },
  });

  return dispatchRideToNearestDemoDriver(ride.id, presenceWindowSeconds);
}


export async function createRideAndCollectDriverOffers(
  input: CreateRideInput,
  offerWindowSeconds = 300
): Promise<RideRow> {
  const riderFarePi = Number(input.price_pi.toFixed(8));
  const driverPayoutPi = Number((riderFarePi * 0.85).toFixed(8));

  const ride = await createRide({
    ...input,
    price_pi: riderFarePi,
    driver_payout_pi: input.driver_payout_pi ?? driverPayoutPi,
    pricing_breakdown: input.pricing_breakdown ?? {
      riderFarePi,
      driverPayoutPi,
      driverPayoutRate: 0.85,
      vehicleType: input.vehicle_type,
      distanceKm: input.distance_km,
      durationMin: input.duration_min,
      pricingMode: "driver_offer_collecting",
      offerWindowSeconds,
    },
  });

  return prepareRideForDriverOffers(ride.id, offerWindowSeconds);
}

export async function getLatestRide(): Promise<RideRow | null> {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as RideRow | null) ?? null;
}

export async function getRideById(id: string): Promise<RideRow | null> {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as RideRow | null) ?? null;
}

export async function updateRideStage(
  id: string,
  status: RideStage
): Promise<RideRow> {
  const now = new Date().toISOString();

  const patch: Partial<RideRow> = {
    status,
  };

  if (status === "driver_arriving") {
    patch.accepted_at = now;
  }

  if (status === "in_progress") {
    patch.started_at = now;
  }

  if (status === "completed") {
    patch.completed_at = now;
  }

  const { data, error } = await supabase
    .from("rides")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as RideRow;
}

export async function assignDriverToRide(
  rideId: string,
  input: {
    driver_user_id?: string | null;
    driver_name: string;
  }
): Promise<RideRow> {
  const { data, error } = await supabase
    .from("rides")
    .update({
      driver_user_id: input.driver_user_id ?? null,
      driver_name: input.driver_name,
      status: "driver_assigned",
    })
    .eq("id", rideId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as RideRow;
}

export async function acceptDemoRide(
  rideId: string,
  driverId: string
): Promise<RideRow> {
  const { data, error } = await supabase.rpc("accept_offered_demo_ride", {
    p_ride_id: rideId,
    p_driver_id: driverId,
  });

  if (error) {
    throw error;
  }

  return data as RideRow;
}

export async function completeDemoRide(
  rideId: string,
  driverId: string
): Promise<RideRow> {
  const { data, error } = await supabase.rpc("complete_demo_ride", {
    p_ride_id: rideId,
    p_driver_id: driverId,
  });

  if (error) {
    throw error;
  }

  return data as RideRow;
}

export async function listRecentRides(limit = 20): Promise<RideRow[]> {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data as RideRow[]) ?? [];
}

export async function prepareRideForDriverOffers(
  rideId: string,
  offerWindowSeconds = 60
): Promise<RideRow> {
  const { data, error } = await supabase.rpc("prepare_ride_for_driver_offers", {
    p_ride_id: rideId,
    p_offer_window_seconds: offerWindowSeconds,
  });

  if (error) {
    throw error;
  }

  return data as RideRow;
}

export async function listRideDriverOffers(
  rideId: string
): Promise<RideDriverOfferRow[]> {
  const { data, error } = await supabase
    .from("ride_driver_offers")
    .select("*")
    .eq("ride_id", rideId)
    .in("offer_status", ["submitted", "shown"])
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as RideDriverOfferRow[]) ?? [];
}

export async function listOpenRideOfferRequestsForDriver(
  driverId: string
): Promise<RideRow[]> {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .eq("status", "collecting_offers")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  const now = Date.now();

  const rows = ((data as RideRow[]) ?? []).filter((ride) => {
    if (ride.demo_driver_id === driverId) {
      return false;
    }

    if (ride.offer_expires_at) {
      const expiresAt = Date.parse(ride.offer_expires_at);

      if (Number.isFinite(expiresAt) && expiresAt <= now + 1500) {
        return false;
      }
    }

    return true;
  });

  return rows;
}

export async function submitDemoDriverRideOffer(input: {
  rideId: string;
  driverId: string;
  offerPricePi: number;
  driverNote?: string | null;
  etaMinutes?: number | null;
}): Promise<RideDriverOfferRow> {
  const { data, error } = await supabase.rpc("submit_demo_driver_ride_offer", {
    p_ride_id: input.rideId,
    p_demo_driver_id: input.driverId,
    p_offer_price_pi: input.offerPricePi,
    p_driver_note: input.driverNote ?? null,
    p_eta_minutes: input.etaMinutes ?? null,
  });

  if (error) {
    throw error;
  }

  return data as RideDriverOfferRow;
}

export async function rejectRideDriverOffer(
  offerId: string
): Promise<RideDriverOfferRow> {
  const { data, error } = await supabase.rpc("reject_ride_driver_offer", {
    p_offer_id: offerId,
  });

  if (error) {
    throw error;
  }

  return data as RideDriverOfferRow;
}

export async function acceptRideDriverOffer(offerId: string): Promise<RideRow> {
  const { data, error } = await supabase.rpc("accept_ride_driver_offer", {
    p_offer_id: offerId,
  });

  if (error) {
    throw error;
  }

  return data as RideRow;
}

export async function expireRideDriverOfferWindow(
  rideId: string
): Promise<RideRow> {
  const { data, error } = await supabase.rpc("expire_ride_driver_offer_window", {
    p_ride_id: rideId,
  });

  if (error) {
    throw error;
  }

  return data as RideRow;
}


export async function resendRideDriverOfferRequest(input: {
  rideId: string;
  newPricePi: number;
  offerWindowSeconds?: number;
}): Promise<RideRow> {
  const { data, error } = await supabase.rpc("resend_ride_driver_offer_request", {
    p_ride_id: input.rideId,
    p_new_price_pi: input.newPricePi,
    p_offer_window_seconds: input.offerWindowSeconds ?? 60,
  });

  if (error) {
    throw error;
  }

  return data as RideRow;
}


export async function cancelRideRequest(rideId: string): Promise<RideRow> {
  const { data, error } = await supabase.rpc("cancel_ride_request", {
    p_ride_id: rideId,
  });

  if (error) {
    throw error;
  }

  return data as RideRow;
}

export async function listDemoDrivers(): Promise<DemoDriverRow[]> {
  const { data, error } = await supabase
    .from("demo_drivers")
    .select("*")
    .order("is_available", { ascending: false })
    .order("display_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as DemoDriverRow[]) ?? [];
}

export async function setDemoDriverAvailability(
  driverId: string,
  isAvailable: boolean
): Promise<void> {
  const { error } = await supabase
    .from("demo_drivers")
    .update({
      is_available: isAvailable,
      updated_at: new Date().toISOString(),
    })
    .eq("id", driverId);

  if (error) {
    throw error;
  }
}

export async function setDemoDriverOnlineStatus(
  driverId: string,
  isOnline: boolean
): Promise<void> {
  const { error } = await supabase
    .from("demo_drivers")
    .update({
      is_online: isOnline,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", driverId);

  if (error) {
    throw error;
  }
}

export async function touchDemoDriverPresence(driverId: string): Promise<void> {
  const { error } = await supabase
    .from("demo_drivers")
    .update({
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", driverId);

  if (error) {
    throw error;
  }
}


export async function ensureDemoDriverReadyForOffers(driverId: string): Promise<void> {
  const timestamp = new Date().toISOString();

  const { error } = await supabase
    .from("demo_drivers")
    .update({
      is_online: true,
      is_available: true,
      last_seen_at: timestamp,
      updated_at: timestamp,
    })
    .eq("id", driverId);

  if (error) {
    throw error;
  }
}

export function subscribeToRide(
  rideId: string,
  onChange: (ride: RideRow) => void
) {
  const channel = supabase
    .channel(`ride-${rideId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "rides",
        filter: `id=eq.${rideId}`,
      },
      (payload) => {
        const next = payload.new as RideRow | undefined;
        if (next) {
          onChange(next);
        }
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToLatestRides(onAnyChange: () => void) {
  const channel = supabase
    .channel("rides-admin")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "rides",
      },
      () => {
        onAnyChange();
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}