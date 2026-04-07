import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

import RiderHome from "./pages/rider/RiderHome";
import RidePage from "./pages/rider/RidePage";
import RideStatus from "./pages/rider/RideStatus";
import DriverHome from "./pages/driver/DriverHome";
import AdminDashboard from "./pages/admin/AdminDashboard";

function landingCardStyle(): React.CSSProperties {
  return {
    maxWidth: 480,
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
  };
}

function Landing() {
  return (
    <div style={{ padding: 20 }}>
      <div style={landingCardStyle()}>
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>TrueGo</h1>
        <p style={{ marginTop: 0, color: "#4b5563" }}>
          Pi Powered Global Mobility Platform
        </p>

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