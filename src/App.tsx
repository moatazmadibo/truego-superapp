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
import ListingReadinessPanel from "./components/ListingReadinessPanel";
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
    maxWidth: 980,
    margin: "40px auto",
    background: "#ffffff",
    borderRadius: 22,
    padding: 24,
    boxShadow: "0 18px 55px rgba(15, 23, 42, 0.12)",
    textAlign: "left",
    border: "1px solid #e5e7eb",
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


function featureCardStyle(): React.CSSProperties {
  return {
    padding: 16,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  };
}

function routeCardStyle(background: string): React.CSSProperties {
  return {
    padding: 18,
    borderRadius: 18,
    background,
    color: "#ffffff",
    textDecoration: "none",
    display: "block",
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
  };
}

function LandingShowcase() {
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginTop: 18,
        }}
      >
        <div style={featureCardStyle()}>
          <div style={{ fontSize: 26 }}>🚕</div>
          <h3 style={{ margin: "8px 0 6px" }}>Ride-hailing flow</h3>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
            A rider can request a trip, receive a fractional Test-Pi fare, and
            complete payment after the ride.
          </p>
        </div>

        <div style={featureCardStyle()}>
          <div style={{ fontSize: 26 }}>🧑‍✈️</div>
          <h3 style={{ margin: "8px 0 6px" }}>Driver operations</h3>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
            Drivers can go online, receive offers, accept or decline, start,
            complete rides, and submit verification documents.
          </p>
        </div>

        <div style={featureCardStyle()}>
          <div style={{ fontSize: 26 }}>🛡️</div>
          <h3 style={{ margin: "8px 0 6px" }}>Safety & verification</h3>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
            Admin can review identity proof, driving license, vehicle license,
            vehicle photo, and profile photo before approval.
          </p>
        </div>

        <div style={featureCardStyle()}>
          <div style={{ fontSize: 26 }}>π</div>
          <h3 style={{ margin: "8px 0 6px" }}>Pi Testnet payment</h3>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
            Payment uses Test-Pi with small fractional values suitable for safe
            listing review and repeated testing.
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: 22,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <Link to="/rider" style={routeCardStyle("#0ea5e9")}>
          <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.9 }}>
            Rider app
          </div>
          <h3 style={{ margin: "8px 0" }}>Book a ride</h3>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            Create a trip, view fare estimate, and pay with Test-Pi.
          </p>
        </Link>

        <Link to="/driver" style={routeCardStyle("#111827")}>
          <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.9 }}>
            Driver console
          </div>
          <h3 style={{ margin: "8px 0" }}>Accept ride offers</h3>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            Go online, handle offers, complete rides, and manage verification.
          </p>
        </Link>

        <Link to="/admin" style={routeCardStyle("#16a34a")}>
          <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.9 }}>
            Admin dashboard
          </div>
          <h3 style={{ margin: "8px 0" }}>Review operations</h3>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            Monitor rides, payments, driver verification, and documents.
          </p>
        </Link>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 16,
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          color: "#9a3412",
          lineHeight: 1.7,
        }}
      >
        <strong>Listing review note:</strong> TrueGo is currently configured as a
        Pi Testnet demo. It uses demo drivers, fractional Test-Pi payments, and
        private driver-document storage for review workflows.
      </div>
    </div>
  );
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
      <ListingReadinessPanel context="landing" />
      <LandingShowcase />
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>TrueGo</h1>

        <p style={{ marginTop: 0, color: "#4b5563" }}>
          Request rides and connect with drivers through the Pi ecosystem.
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
            Continue to Rider App
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
