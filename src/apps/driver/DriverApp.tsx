import { Route, Routes } from "react-router-dom";
import DriverHome from "../../pages/driver/DriverHome";

export default function DriverApp() {
  return (
    <Routes>
      <Route index element={<DriverHome />} />
    </Routes>
  );
}
