import { Route, Routes } from "react-router-dom";
import RiderHome from "../../pages/rider/RiderHome";
import RidePage from "../../pages/rider/RidePage";
import RideStatus from "../../pages/rider/RideStatus";

export default function RiderApp() {
  return (
    <Routes>
      <Route index element={<RiderHome />} />
      <Route path="ride" element={<RidePage />} />
      <Route path="status/:rideId" element={<RideStatus />} />
    </Routes>
  );
}
