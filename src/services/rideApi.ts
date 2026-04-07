import { supabase } from "../lib/supabase";

export type RideStage =
  | "searching"
  | "driver_assigned"
  | "driver_arriving"
  | "in_progress"
  | "completed";

export interface RideRow {
  id: string;
  rider_name: string | null;
  driver_name: string | null;
  pickup: string;
  destination: string;
  distance_km: number | null;
  duration_min: number | null;
  price_pi: number | null;
  status: RideStage;
  created_at: string;
}

export async function createRide(input: {
  rider_name?: string;
  driver_name?: string;
  pickup: string;
  destination: string;
  distance_km: number;
  duration_min: number;
  price_pi: number;
}): Promise<RideRow> {
  const { data, error } = await supabase
    .from("rides")
    .insert({
      rider_name: input.rider_name ?? "Rider",
      driver_name: input.driver_name ?? "Ahmed",
      pickup: input.pickup,
      destination: input.destination,
      distance_km: input.distance_km,
      duration_min: input.duration_min,
      price_pi: input.price_pi,
      status: "driver_assigned",
    })
    .select()
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
  const { data, error } = await supabase
    .from("rides")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as RideRow;
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
    supabase.removeChannel(channel);
  };
}

export function subscribeToLatestRides(
  onAnyChange: () => void
) {
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
    supabase.removeChannel(channel);
  };
}