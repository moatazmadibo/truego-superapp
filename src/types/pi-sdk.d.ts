export interface PiPaymentData {
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
}

export interface PiPayment {
  identifier: string;
  amount?: number;
  memo?: string;
  metadata?: Record<string, unknown>;
  transaction?: {
    txid?: string;
  };
}

export interface PiPaymentCallbacks {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: PiPayment) => void;
}

export interface PiAuthResult {
  accessToken: string;
  user: {
    uid: string;
    username?: string;
    wallet_address?: string;
  };
}

export interface PiSdk {
  init: (config: { version: string; sandbox?: boolean }) => void;
  authenticate: (
    scopes: Array<"username" | "payments" | "wallet_address">,
    onIncompletePaymentFound: (payment: PiPayment) => void
  ) => Promise<PiAuthResult>;
  createPayment: (
    data: PiPaymentData,
    callbacks: PiPaymentCallbacks
  ) => void;
}

declare global {
  interface Window {
    Pi?: PiSdk;
  }
}
