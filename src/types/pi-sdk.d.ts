export type PiAuthScope = "username" | "payments" | "wallet_address";

export interface PiAuthUser {
  uid: string;
  username: string;
  wallet_address?: string;
}

export interface PiAuthResult {
  user: PiAuthUser;
  accessToken: string;
}

export interface PiPaymentData {
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
  uid?: string;
}

export interface PiPayment {
  identifier: string;
  amount: number;
  memo: string;
  metadata?: Record<string, unknown>;
  from_address?: string;
  to_address?: string;
  user_uid?: string;
  created_at?: string;
  transaction?: {
    txid?: string;
    verified?: boolean;
    _link?: string;
  };
  status?: {
    developer_approved?: boolean;
    transaction_verified?: boolean;
    developer_completed?: boolean;
    cancelled?: boolean;
    user_cancelled?: boolean;
  };
}

export interface PiPaymentCallbacks {
  onReadyForServerApproval?: (paymentId: string) => void | Promise<void>;
  onReadyForServerCompletion?: (
    paymentId: string,
    txid: string
  ) => void | Promise<void>;
  onCancel?: (paymentId: string) => void;
  onError?: (error: Error, payment?: PiPayment) => void;
}

export interface PiSdk {
  init(options: { version: string; sandbox?: boolean }): void;
  authenticate(
    scopes: PiAuthScope[],
    onIncompletePaymentFound: (payment: PiPayment) => void
  ): Promise<PiAuthResult>;
  createPayment(
    paymentData: PiPaymentData,
    callbacks: PiPaymentCallbacks
  ): void;
}

declare global {
  interface Window {
    Pi?: PiSdk;
  }
}

export {};
