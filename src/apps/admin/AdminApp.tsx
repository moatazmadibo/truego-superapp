import { Route, Routes } from "react-router-dom";
import AdminDashboard from "../../pages/admin/AdminDashboard";

export default function AdminApp() {
  return (
    <Routes>
      <Route index element={<AdminDashboard />} />
    </Routes>
  );
}
