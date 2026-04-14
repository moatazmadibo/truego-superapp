import { useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

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
  type StoredPiSession,
} from "./lib/pi";

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

function linkStyle(background: string): React.CSSProperties {
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

function authButtonStyle(
  background: string,
  disabled = false
): React.CSSProperties {
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
    marginLeft: 10,
  };
}

function Landing() {
  const [session, setSession] = useState<StoredPiSession | null>(() =>
    getStoredPiSession()
  );
  const [sdkChecked, setSdkChecked] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        await initPiSdk();

        if (!isMounted) {
          return;
        }

        setSdkReady(isPiSdkAvailable());
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
    setAuthError("");

    try {
      const nextSession = await loginWithPi();
      setSession(nextSession);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Pi login failed.";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }

  function handlePiLogout() {
    clearStoredPiSession();
    setSession(null);
    setAuthError("");
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

              <button
                type="button"
                style={secondaryButtonStyle()}
                onClick={handlePiLogout}
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <div style={{ color: "#4b5563" }}>
                {!sdkChecked
                  ? "Checking Pi Browser..."
                  : sdkReady
                  ? "Sign in with Pi to personalize your TrueGo session."
                  : "Open this page inside Pi Browser to sign in with Pi."}
              </div>

              <button
                type="button"
                style={authButtonStyle("#111827", !sdkReady || authLoading)}
                onClick={() => {
                  void handlePiLogin();
                }}
                disabled={!sdkReady || authLoading}
              >
                {authLoading ? "Signing in..." : "Login with Pi"}
              </button>
            </>
          )}

          {authError ? (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 10,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                fontSize: 14,
              }}
            >
              {authError}
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 24 }}>
          <Link to="/rider" style={linkStyle("#0ea5e9")}>
            Rider App
          </Link>

          <Link to="/driver" style={linkStyle("#10b981")}>
            Driver App
          </Link>

          <Link to="/admin" style={linkStyle("#8b5cf6")}>
            Admin Portal
          </Link>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/rider" element={<RiderHome />} />
        <Route path="/rider/ride" element={<RidePage />} />
        <Route path="/rider/status/:rideId" element={<RideStatus />} />
        <Route path="/driver" element={<DriverHome />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
