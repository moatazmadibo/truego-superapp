const ADMIN_SESSION_KEY = "truego_admin_access_session";
const ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

type StoredAdminSession = {
  grantedAt: number;
  expiresAt: string;
  sessionToken: string;
};

export function getAdminSessionToken() {
  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);

    if (!raw) {
      return "";
    }

    const session = JSON.parse(raw) as StoredAdminSession;
    const expiresAtMs = Date.parse(session.expiresAt);

    if (!session.grantedAt || !expiresAtMs || !session.sessionToken) {
      window.localStorage.removeItem(ADMIN_SESSION_KEY);
      return "";
    }

    if (Date.now() > expiresAtMs || Date.now() - session.grantedAt > ADMIN_SESSION_MAX_AGE_MS) {
      window.localStorage.removeItem(ADMIN_SESSION_KEY);
      return "";
    }

    return session.sessionToken;
  } catch {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    return "";
  }
}

export function requireAdminSessionToken() {
  const token = getAdminSessionToken();

  if (!token) {
    throw new Error("Admin session expired. Lock admin, then unlock again.");
  }

  return token;
}
