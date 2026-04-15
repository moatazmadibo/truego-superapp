import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import RiderHome from "./pages/rider/RiderHome";
import RidePage from "./pages/rider/RidePage";
import RideStatus from "./pages/rider/RideStatus";
import DriverHome from "./pages/driver/DriverHome";
import AdminDashboard from "./pages/admin/AdminDashboard";
import {
  clearStoredPiSession,
  getStoredPiSession,
  initPiSdk,
  isPiSdkAvailable,
  loginWithPi,
  saveStoredPiSession,
  type StoredPiSession,
} from "./lib/pi";
import { syncPiUser } from "./services/piAuthApi";

function landingCardStyle(): React.CSSProperties {
  return {
    maxWidth: 520,
    margin: "60px auto",
    background: "#ffffff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
    textAlign: "center",
  };
}

function linkStyle(background: string, disabled = false): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    padding: 14,
    borderRadius: 10,
    background,
    color: "#ffffff",
    marginTop: 12,
    textDecoration: "none",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    pointerEvents: disabled ? "none" : "auto",
  };
}

function authPanelStyle(): React.CSSProperties {
  return {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    textAlign: "left",
  };
}

function authButtonStyle(background: string, disabled = false): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "10px 14px",
    borderRadius: 10,
    background,
    color: "#ffffff",
    border: "1px solid transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontWeight: 600,
    marginTop: 10,
  };
}

function secondaryButtonStyle(): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "10px 14px",
    borderRadius: 10,
    background: "#ffffff",
    color: "#111827",
    border: "1px solid #d1d5db",
    cursor: "pointer",
    fontWeight: 600,
    marginTop: 10,
  };
}

function warningBoxStyle(): React.CSSProperties {
  return {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    background: "#fff7ed",
    border: "1px solid #fdba74",
    color: "#9a3412",
    fontSize: 14,
  };
}

function errorBoxStyle(): React.CSSProperties {
  return {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    fontSize: 14,
  };
}

function infoBoxStyle(): React.CSSProperties {
  return {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: 14,
  };
}

function RequirePiAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const session = getStoredPiSession();

  if (!session) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

function Landing() {
  const location = useLocation();
  const navigate = useNavigate();

  const [session, setSession] = useState<StoredPiSession | null>(() =>
    getStoredPiSession()
  );
  const [sdkChecked, setSdkChecked] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [serverSyncing, setServerSyncing] = useState(false);
  const [authError, setAuthError] = useState("");
  const [serverWarning, setServerWarning] = useState("");

  const pendingPath = useMemo(() => {
    const maybeFrom = (location.state as { from?: string } | null)?.from;
    return maybeFrom && maybeFrom !== "/" ? maybeFrom : null;
  }, [location.state]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const ready = await initPiSdk();

        if (!isMounted) {
          return;
        }

        setSdkReady(ready && isPiSdkAvailable());
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Failed to initialize Pi SDK.";

        setAuthError(message);
      } finally {
        if (isMounted) {
          setSdkChecked(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handlePiLogin() {
    setAuthLoading(true);
    setServerSyncing(false);
    setAuthError("");
    setServerWarning("");

    try {
      const loginResult = await loginWithPi();

      const localSession: StoredPiSession = {
        uid: loginResult.session.uid,
        username: loginResult.session.username,
        authenticatedAt: loginResult.session.authenticatedAt,
      };

      saveStoredPiSession(localSession);
      setSession(localSession);

      setAuthLoading(false);
      setServerSyncing(true);

      try {
        const syncedUser = await syncPiUser(loginResult.accessToken);

        const canonicalSession: StoredPiSession = {
          uid: syncedUser.uid,
          username: syncedUser.username,
          authenticatedAt: syncedUser.authenticatedAt,
        };

        saveStoredPiSession(canonicalSession);
        setSession(canonicalSession);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Pi server verification failed.";

        setServerWarning(
          `Pi login succeeded locally, but server verification is still pending. Details: ${message}`
        );
      }

      if (pendingPath) {
        navigate(pendingPath, { replace: true });
      }
    } catch (error) {
      clearStoredPiSession();
      setSession(null);

      const message =
        error instanceof Error ? error.message : "Pi login failed.";

      setAuthError(message);
    } finally {
      setAuthLoading(false);
      setServerSyncing(false);
    }
  }

  function handlePiLogout() {
    clearStoredPiSession();
    setSession(null);
    setAuthError("");
    setServerWarning("");
    navigate("/", { replace: true });
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={landingCardStyle()}>
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>TrueGo</h1>

        <p style={{ marginTop: 0, color: "#4b5563" }}>
          Pi Powered Global Mobility Platform
        </p>

        <div style={authPanelStyle()}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Pi Login</div>

          {session ? (
            <>
              <div style={{ color: "#111827" }}>
                Connected as <strong>@{session.username}</strong>
              </div>
              <div style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
                Connected at {new Date(session.authenticatedAt).toLocaleString()}
              </div>

              {pendingPath ? (
                <div style={infoBoxStyle()}>
                  Continue to your requested page:
                  <div style={{ marginTop: 6, fontWeight: 700 }}>{pendingPath}</div>
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {pendingPath ? (
                  <button
                    type="button"
                    style={authButtonStyle("#111827")}
                    onClick={() => navigate(pendingPath)}
                  >
                    Continue
                  </button>
                ) : null}

                <button
                  type="button"
                  style={secondaryButtonStyle()}
                  onClick={handlePiLogout}
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ color: "#4b5563" }}>
                {!sdkChecked
                  ? "Checking Pi Browser..."
                  : authLoading
                  ? "Opening Pi login..."
                  : serverSyncing
                  ? "Verifying with TrueGo server..."
                  : sdkReady
                  ? "Sign in with Pi to access TrueGo."
                  : "Open this page inside Pi Browser to sign in with Pi."}
              </div>

              <button
                type="button"
                style={authButtonStyle("#111827", !sdkReady || authLoading || serverSyncing)}
                onClick={() => {
                  void handlePiLogin();
                }}
                disabled={!sdkReady || authLoading || serverSyncing}
              >
                {authLoading || serverSyncing ? "Signing in..." : "Login with Pi"}
              </button>
            </>
          )}

          {serverWarning ? <div style={warningBoxStyle()}>{serverWarning}</div> : null}
          {authError ? <div style={errorBoxStyle()}>{authError}</div> : null}
        </div>

        <div style={{ marginTop: 24 }}>
          <Link to="/rider" style={linkStyle("#0ea5e9", !session)}>
            Rider App
          </Link>

          <Link to="/driver" style={linkStyle("#10b981", !session)}>
            Driver App
          </Link>

          <Link to="/admin" style={linkStyle("#8b5cf6", !session)}>
            Admin Portal
          </Link>
        </div>

        {!session ? (
          <div style={infoBoxStyle()}>
            TrueGo is configured for Pi-exclusive authentication. Please sign in with Pi to continue.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/rider"
          element={
            <RequirePiAuth>
              <RiderHome />
            </RequirePiAuth>
          }
        />
        <Route
          path="/rider/ride"
          element={
            <RequirePiAuth>
              <RidePage />
            </RequirePiAuth>
          }
        />
        <Route
          path="/rider/status/:rideId"
          element={
            <RequirePiAuth>
              <RideStatus />
            </RequirePiAuth>
          }
        />
        <Route
          path="/driver"
          element={
            <RequirePiAuth>
              <DriverHome />
            </RequirePiAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequirePiAuth>
              <AdminDashboard />
            </RequirePiAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
