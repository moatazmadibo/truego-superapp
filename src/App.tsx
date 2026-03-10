import { BrowserRouter, Routes, Route } from "react-router-dom";

import RiderHome from "./pages/rider/RiderHome";
import DriverHome from "./pages/driver/DriverHome";
import AdminDashboard from "./pages/admin/AdminDashboard";

function Landing() {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>TrueGo</h1>
      <p>Pi Powered Global Mobility Platform</p>

      <div style={{ marginTop: 30 }}>
        <a href="/rider">Rider App</a>
        <br /><br />
        <a href="/driver">Driver App</a>
        <br /><br />
        <a href="/admin">Admin Portal</a>
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

        <Route path="/driver" element={<DriverHome />} />

        <Route path="/admin" element={<AdminDashboard />} />

      </Routes>

    </BrowserRouter>
  );
}

export default App;