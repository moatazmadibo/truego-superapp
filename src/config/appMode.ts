export type TrueGoAppMode = "all" | "rider" | "driver" | "admin";
export type TrueGoAppName = "rider" | "driver" | "admin";

const allowedModes: TrueGoAppMode[] = ["all", "rider", "driver", "admin"];

export function getTrueGoAppMode(): TrueGoAppMode {
  const raw = (import.meta.env.VITE_TRUEGO_APP_MODE as string | undefined)
    ?.toLowerCase()
    .trim();

  if (raw && allowedModes.includes(raw as TrueGoAppMode)) {
    return raw as TrueGoAppMode;
  }

  return "all";
}

export function isAppModeEnabled(
  mode: TrueGoAppMode,
  app: TrueGoAppName
): boolean {
  return mode === "all" || mode === app;
}

export function getAppModeHomePath(mode: TrueGoAppMode): string {
  switch (mode) {
    case "driver":
      return "/driver";
    case "admin":
      return "/admin";
    case "rider":
    case "all":
    default:
      return "/rider";
  }
}

export function getAppModeLabel(mode: TrueGoAppMode): string {
  switch (mode) {
    case "driver":
      return "Continue to Driver App";
    case "admin":
      return "Continue to Admin Platform";
    case "rider":
    case "all":
    default:
      return "Continue to Rider App";
  }
}
