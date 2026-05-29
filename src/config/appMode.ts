export type TrueGoAppMode = "all" | "rider" | "driver" | "admin";

function isValidAppMode(value: string): value is TrueGoAppMode {
  return value === "all" || value === "rider" || value === "driver" || value === "admin";
}

function inferModeFromHostname(): TrueGoAppMode | null {
  if (typeof window === "undefined") {
    return null;
  }

  const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes("truego-rider")) {
    return "rider";
  }

  if (hostname.includes("truego-driver")) {
    return "driver";
  }

  if (hostname.includes("truego-admin")) {
    return "admin";
  }

  // Current App Studio / pinet app is the rider-facing TrueGo app.
  if (hostname.includes("truegocaebcb2170.pinet.com")) {
    return "rider";
  }

  return null;
}

export function getTrueGoAppMode(): TrueGoAppMode {
  const raw = (import.meta.env.VITE_TRUEGO_APP_MODE as string | undefined)
    ?.trim()
    .toLowerCase();

  if (raw && isValidAppMode(raw)) {
    return raw;
  }

  return inferModeFromHostname() ?? "all";
}

export function isAppModeEnabled(appMode: TrueGoAppMode, target: Exclude<TrueGoAppMode, "all">) {
  return appMode === "all" || appMode === target;
}

export function getAppModeHomePath(appMode: TrueGoAppMode) {
  if (appMode === "driver") return "/driver";
  if (appMode === "admin") return "/admin";
  return "/rider";
}

export function getAppModeLabel(appMode: TrueGoAppMode) {
  if (appMode === "driver") return "Continue to Driver App";
  if (appMode === "admin") return "Continue to Admin Platform";
  return "Continue to Rider App";
}
