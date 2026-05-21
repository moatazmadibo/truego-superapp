import { supabase } from "../lib/supabase";

export async function approvePiRidePayment(input: {
  rideId: string;
  paymentId: string;
  amountPi: number;
}) {
  const { data, error } = await supabase.functions.invoke("pi-payment-approve", {
    body: input,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function completePiRidePayment(input: {
  rideId: string;
  paymentId: string;
  txid: string;
  amountPi: number;
}) {
  const { data, error } = await supabase.functions.invoke("pi-payment-complete", {
    body: input,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function prepareRidePiPaymentRetry(input: {
  rideId: string;
  reason?: string;
}) {
  const { data, error } = await supabase.rpc("prepare_ride_pi_payment_retry", {
    p_ride_id: input.rideId,
    p_reason: input.reason ?? null,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function registerRidePiPaymentAttempt(input: {
  rideId: string;
  paymentId: string;
}) {
  const { data, error } = await supabase.rpc("register_ride_pi_payment_attempt", {
    p_ride_id: input.rideId,
    p_payment_id: input.paymentId,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function clearRidePiPaymentAttempt(input: {
  rideId: string;
  paymentId?: string | null;
  reason?: string;
}) {
  const { data, error } = await supabase.rpc("clear_ride_pi_payment_attempt", {
    p_ride_id: input.rideId,
    p_payment_id: input.paymentId ?? null,
    p_reason: input.reason ?? "Pi payment attempt failed or expired",
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function cancelRidePiPaymentAttempt(input: {
  rideId: string;
  paymentId?: string | null;
  reason?: string;
}) {
  const { data, error } = await supabase.rpc("cancel_ride_pi_payment_attempt", {
    p_ride_id: input.rideId,
    p_payment_id: input.paymentId ?? null,
    p_reason: input.reason ?? "User cancelled Pi payment",
  });

  if (error) {
    throw error;
  }

  return data;
}
