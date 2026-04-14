import type { PiAuthResult, PiAuthScope } from "../types/pi-sdk";

const PI_SDK_SCRIPT_URL = "https://sdk.minepi.com/pi-sdk.js";
const PI_SESSION_STORAGE_KEY = "truego_pi_session";

export type StoredPiSession = {
  uid: string;
  username: string;
  authenticatedAt: string;
};

let sdkInitialized = false;
let sdkInitPromise: Promise<boolean> | null = null;

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

function waitForExistingScript(script: HTMLScriptElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (script.dataset.loaded === "true") {
      resolve();
      return;
    }

    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });

    script.addEventListener("error", () => {
      reject(new Error("Failed to load Pi SDK script."));
    });
  });
}

async function ensurePiSdkScript(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${PI_SDK_SCRIPT_URL}"]`
  );

  if (existing) {
    await waitForExistingScript(existing);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PI_SDK_SCRIPT_URL;
    script.async = true;

    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });

    script.addEventListener("error", () => {
      reject(new Error("Failed to load Pi SDK script."));
    });

    document.head.appendChild(script);
  });
}

export function isPiSdkAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.Pi !== "undefined";
}

export async function initPiSdk(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  if (sdkInitialized && window.Pi) {
    return true;
  }

  if (!sdkInitPromise) {
    sdkInitPromise = (async () => {
      await ensurePiSdkScript();

      if (!window.Pi) {
        return false;
      }

      window.Pi.init({
        version: "2.0",
        sandbox: getSandboxFlag(),
      });

      sdkInitialized = true;
      return true;
    })().finally(() => {
      sdkInitPromise = null;
    });
  }

  return sdkInitPromise;
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

export function clearStoredPiSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PI_SESSION_STORAGE_KEY);
}

function persistPiSession(session: StoredPiSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PI_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function loginWithPi(): Promise<StoredPiSession> {
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

  persistPiSession(session);
  return session;
}
