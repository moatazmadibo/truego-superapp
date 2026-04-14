import type { PiAuthResult, PiAuthScope } from "../types/pi-sdk";

const PI_SESSION_STORAGE_KEY = "truego_pi_session";

export type StoredPiSession = {
  uid: string;
  username: string;
  authenticatedAt: string;
};

export type PiLoginResult = {
  session: StoredPiSession;
  accessToken: string;
};

let sdkInitialized = false;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getSandboxFlag(): boolean {
  const explicitValue = import.meta.env.VITE_PI_SANDBOX;

  if (explicitValue === "true") {
    return true;
  }

  if (explicitValue === "false") {
    return false;
  }

  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

export function isPiSdkAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.Pi !== "undefined";
}

export async function initPiSdk(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (window.Pi) {
      if (!sdkInitialized) {
        try {
          window.Pi.init({
            version: "2.0",
            sandbox: getSandboxFlag(),
          });
          sdkInitialized = true;
        } catch (error) {
          console.error("Pi.init failed:", error);
          return false;
        }
      }

      return true;
    }

    await sleep(200);
  }

  return false;
}

export function getStoredPiSession(): StoredPiSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(PI_SESSION_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredPiSession;
  } catch {
    window.localStorage.removeItem(PI_SESSION_STORAGE_KEY);
    return null;
  }
}

export function saveStoredPiSession(session: StoredPiSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PI_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredPiSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PI_SESSION_STORAGE_KEY);
}

export async function loginWithPi(): Promise<PiLoginResult> {
  const ready = await initPiSdk();

  if (!ready || !window.Pi) {
    throw new Error("Pi SDK is not available. Open TrueGo inside Pi Browser.");
  }

  const scopes: PiAuthScope[] = ["username"];

  const authResult: PiAuthResult = await window.Pi.authenticate(
    scopes,
    (payment) => {
      console.warn("Incomplete Pi payment found:", payment);
    }
  );

  const session: StoredPiSession = {
    uid: authResult.user.uid,
    username: authResult.user.username,
    authenticatedAt: new Date().toISOString(),
  };

  saveStoredPiSession(session);

  return {
    session,
    accessToken: authResult.accessToken,
  };
}
