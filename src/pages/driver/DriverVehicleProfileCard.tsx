import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { DemoDriverRow } from "../../services/rideApi";

type VehicleProfileRow = {
  id: string;
  display_name: string;
  vehicle_type: "car" | "motorcycle";
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
  vehicle_year: number | null;
  vehicle_license_expires_at: string | null;
  driver_license_expires_at: string | null;
  profile_photo_path: string | null;
};

function sectionStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
    font: "inherit",
    marginTop: 6,
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    marginTop: 12,
    fontWeight: 800,
    color: "#334155",
    fontSize: 13,
  };
}

function buttonStyle(disabled = false): React.CSSProperties {
  return {
    border: 0,
    borderRadius: 12,
    padding: "12px 16px",
    color: "#ffffff",
    background: "#0f766e",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

function messageStyle(type: "success" | "error"): React.CSSProperties {
  return {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    background: type === "success" ? "#ecfdf5" : "#fef2f2",
    border: type === "success" ? "1px solid #bbf7d0" : "1px solid #fecaca",
    color: type === "success" ? "#047857" : "#b91c1c",
    lineHeight: 1.6,
  };
}

export default function DriverVehicleProfileCard({ driver }: { driver: DemoDriverRow }) {
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [driverLicenseExpiry, setDriverLicenseExpiry] = useState("");
  const [profilePhotoPath, setProfilePhotoPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function applyProfile(row: VehicleProfileRow | null | undefined) {
    if (!row) return;

    setVehicleMake(row.vehicle_make ?? "");
    setVehicleModel(row.vehicle_model ?? "");
    setVehicleColor(row.vehicle_color ?? "");
    setVehiclePlate(row.vehicle_plate ?? "");
    setVehicleYear(row.vehicle_year != null ? String(row.vehicle_year) : "");
    setLicenseExpiry(row.vehicle_license_expires_at ?? "");
    setDriverLicenseExpiry(row.driver_license_expires_at ?? "");
    setProfilePhotoPath(row.profile_photo_path ?? "");
  }

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      setLoading(true);
      setError("");

      const { data, error: loadError } = await supabase.rpc(
        "get_demo_driver_vehicle_profile",
        {
          p_driver_id: driver.id,
        }
      );

      if (!mounted) return;

      if (loadError) {
        setError(loadError.message);
      } else {
        applyProfile(data as VehicleProfileRow);
      }

      setLoading(false);
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [driver.id]);

  async function handleSave() {
    const parsedYear = vehicleYear.trim() ? Number(vehicleYear.trim()) : null;

    if (parsedYear != null && (!Number.isInteger(parsedYear) || parsedYear < 1980 || parsedYear > 2100)) {
      setError("Vehicle year must be between 1980 and 2100.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const { data, error: saveError } = await supabase.rpc(
      "update_demo_driver_vehicle_profile",
      {
        p_driver_id: driver.id,
        p_vehicle_make: vehicleMake,
        p_vehicle_model: vehicleModel,
        p_vehicle_color: vehicleColor,
        p_vehicle_plate: vehiclePlate,
        p_vehicle_year: parsedYear,
        p_vehicle_license_expires_at: licenseExpiry || null,
        p_driver_license_expires_at: driverLicenseExpiry || null,
        p_profile_photo_path: profilePhotoPath || null,
      }
    );

    if (saveError) {
      setError(saveError.message);
    } else {
      applyProfile(data as VehicleProfileRow);
      setMessage("Vehicle profile saved successfully.");
    }

    setSaving(false);
  }

  return (
    <div style={sectionStyle()}>
      <h2 style={{ marginTop: 0 }}>Vehicle Profile</h2>
      <p style={{ marginTop: 6, color: "#475569", lineHeight: 1.6 }}>
        Keep the driver's vehicle details updated for admin review, document verification,
        and future ride audit. Update this when the vehicle changes or the vehicle license is renewed.
      </p>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          color: "#9a3412",
          lineHeight: 1.6,
        }}
      >
        <strong>Current vehicle type:</strong> {driver.vehicle_type}
      </div>

      <label style={labelStyle()} htmlFor="vehicle-make">Make</label>
      <input
        id="vehicle-make"
        value={vehicleMake}
        onChange={(event) => setVehicleMake(event.target.value)}
        placeholder="Example: Toyota"
        style={inputStyle()}
      />

      <label style={labelStyle()} htmlFor="vehicle-model">Model</label>
      <input
        id="vehicle-model"
        value={vehicleModel}
        onChange={(event) => setVehicleModel(event.target.value)}
        placeholder="Example: Corolla"
        style={inputStyle()}
      />

      <label style={labelStyle()} htmlFor="vehicle-color">Color</label>
      <input
        id="vehicle-color"
        value={vehicleColor}
        onChange={(event) => setVehicleColor(event.target.value)}
        placeholder="Example: White"
        style={inputStyle()}
      />

      <label style={labelStyle()} htmlFor="vehicle-plate">Plate number</label>
      <input
        id="vehicle-plate"
        value={vehiclePlate}
        onChange={(event) => setVehiclePlate(event.target.value)}
        placeholder="Example: ABC-1234"
        style={inputStyle()}
      />

      <label style={labelStyle()} htmlFor="vehicle-year">Vehicle year</label>
      <input
        id="vehicle-year"
        value={vehicleYear}
        onChange={(event) => setVehicleYear(event.target.value)}
        placeholder="Example: 2020"
        inputMode="numeric"
        style={inputStyle()}
      />

      <label style={labelStyle()} htmlFor="vehicle-license-expiry">
        Vehicle license expiry
      </label>
      <input
        id="vehicle-license-expiry"
        type="date"
        value={licenseExpiry}
        onChange={(event) => setLicenseExpiry(event.target.value)}
        style={inputStyle()}
      />

      <label style={labelStyle()} htmlFor="driver-license-expiry">
        Driver license expiry
      </label>
      <input
        id="driver-license-expiry"
        type="date"
        value={driverLicenseExpiry}
        onChange={(event) => setDriverLicenseExpiry(event.target.value)}
        style={inputStyle()}
      />

      <label style={labelStyle()} htmlFor="profile-photo-path">
        Profile photo path
      </label>
      <input
        id="profile-photo-path"
        value={profilePhotoPath}
        onChange={(event) => setProfilePhotoPath(event.target.value)}
        placeholder="Example: ahmed/profile_photo/..."
        style={inputStyle()}
      />

      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          background: profilePhotoPath ? "#ecfdf5" : "#f8fafc",
          border: profilePhotoPath ? "1px solid #bbf7d0" : "1px solid #e5e7eb",
          color: profilePhotoPath ? "#047857" : "#475569",
          lineHeight: 1.6,
          fontSize: 14,
        }}
      >
        <strong>Profile photo:</strong>{" "}
        {profilePhotoPath
          ? "Profile photo path is linked to this driver profile."
          : "No profile photo path linked yet. Upload a profile_photo document first, then link its file path here."}
      </div>

      {error ? <div style={messageStyle("error")}>{error}</div> : null}
      {message ? <div style={messageStyle("success")}>{message}</div> : null}

      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={() => {
            void handleSave();
          }}
          disabled={loading || saving}
          style={buttonStyle(loading || saving)}
        >
          {saving ? "Saving..." : loading ? "Loading..." : "Save Vehicle Profile"}
        </button>
      </div>
    </div>
  );
}
