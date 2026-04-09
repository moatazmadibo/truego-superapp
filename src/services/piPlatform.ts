import type {
  PiAuthResult,
  PiPayment,
  PiPaymentCallbacks,
  PiPaymentData,
  PiSdk,
} from "../types/pi-sdk";

export type PiScope = "username" | "payments" | "wallet_address";

export function getPiSdk(): PiSdk | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.Pi ?? null;
}

export function isPiBrowser(): boolean {
  return getPiSdk() !== null;
}

export async function authenticateWithPi(
  scopes: PiScope[] = ["username", "payments"] ,
  onIncompletePaymentFound: (payment: PiPayment) => void = () => undefined
): Promise<PiAuthResult> {
  const pi = getPiSdk();

  if (!pi) {
    throw new Error("Pi SDK is not available. Open the app inside Pi Browser.");
  }

  return pi.authenticate(scopes, onIncompletePaymentFound);
}

export function createPiPayment(
  paymentData: PiPaymentData,
  callbacks: PiPaymentCallbacks
): void {
  const pi = getPiSdk();

  if (!pi) {
    throw new Error("Pi SDK is not available. Open the app inside Pi Browser.");
  }

  pi.createPayment(paymentData, callbacks);
}
