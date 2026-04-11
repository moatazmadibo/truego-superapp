import { supabase } from "../lib/supabase";

export type VehicleType = "car" | "motorcycle";

export type RideStage =
  | "searching"
  | "driver_assigned"
  | "driver_arriving"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface RideRow {
  id: string;
  rider_user_id: string | null;
  rider_name: string | null;
  driver_user_id: string | null;
  driver_name: string | null;
  pickup_text: string;
  destination_text: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  distance_km: number;
  duration_min: number;
  price_pi: number;
  vehicle_type: VehicleType;
  status: RideStage;
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface DemoDriverRow {
  id: string;
  display_name: string;
  vehicle_type: VehicleType;
  is_available: boolean;
  rating: number;
  lat: number | null;
  lng: number | null;
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
  vehicle_type: VehicleType;
  status?: RideStage;
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
  const { data, error } = await supabase.rpc("accept_demo_ride", {
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