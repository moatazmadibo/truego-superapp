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
