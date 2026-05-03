import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { DemoDriverRow } from "../../services/rideApi";

type DriverVerificationStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "rejected"
  | "needs_more_info";

type VerificationRow = {
  demo_driver_id?: string;
  driver_name?: string;
  verification_status?: DriverVerificationStatus;
  admin_review_notes?: string | null;
  submitted_at?: string | null;
  verified_at?: string | null;
  updated_at?: string | null;
};

function getDriverDisplayName(driver: DemoDriverRow) {
  const record = driver as DemoDriverRow & {
    name?: string | null;
    driver_name?: string | null;
    display_name?: string | null;
    full_name?: string | null;
  };

  return (
    record.name ??
    record.driver_name ??
    record.display_name ??
    record.full_name ??
    driver.id
  );
}

function formatVerificationStatus(status: DriverVerificationStatus) {
  switch (status) {
    case "pending":
      return "Pending";
    case "submitted":
      return "Submitted for review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "needs_more_info":
      return "Needs more info";
    default:
      return status;
  }
}

function verificationBadgeColor(status: DriverVerificationStatus) {
  switch (status) {
    case "approved":
      return "#16a34a";
    case "submitted":
      return "#2563eb";
    case "needs_more_info":
      return "#d97706";
    case "rejected":
      return "#dc2626";
    default:
      return "#64748b";
  }
}

function sectionStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  };
}

function buttonStyle(background: string, disabled = false): React.CSSProperties {
  return {
    border: 0,
    borderRadius: 12,
    padding: "12px 16px",
    color: "#ffffff",
    background,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

export default function DriverVerificationCard({ driver }: { driver: DemoDriverRow }) {
  const driverName = getDriverDisplayName(driver);

  const [status, setStatus] = useState<DriverVerificationStatus>("pending");
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function applyVerificationRow(row: VerificationRow | null | undefined) {
    if (!row) return;

    setStatus((row.verification_status ?? "pending") as DriverVerificationStatus);
    setVerifiedAt(row.verified_at ?? null);
    setSubmittedAt(row.submitted_at ?? null);
    setAdminNotes(row.admin_review_notes ?? null);
  }

  useEffect(() => {
    let mounted = true;

    async function loadVerification() {
      setLoading(true);
      setError("");

      const { data, error: loadError } = await supabase.rpc(
        "get_demo_driver_verification",
        {
          p_demo_driver_id: driver.id,
          p_driver_name: driverName,
        }
      );

      if (!mounted) return;

      if (loadError) {
        setError(loadError.message);
      } else {
        applyVerificationRow(data as VerificationRow);
      }

      setLoading(false);
    }

    void loadVerification();

    return () => {
      mounted = false;
    };
  }, [driver.id, driverName]);

  async function handleSubmitVerification() {
    setActionLoading(true);
    setError("");
    setMessage("");

    const { data, error: submitError } = await supabase.rpc(
      "submit_demo_driver_verification",
      {
        p_demo_driver_id: driver.id,
        p_driver_name: driverName,
      }
    );

    if (submitError) {
      setError(submitError.message);
    } else {
      applyVerificationRow(data as VerificationRow);
      setMessage("Verification request submitted. Admin can review this driver from the admin dashboard.");
    }

    setActionLoading(false);
  }

  return (
    <div style={sectionStyle()}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Driver Verification</h2>
          <p style={{ margin: "6px 0 0", color: "#475569" }}>
            TrueGo keeps driver verification ready for safety and listing review.
          </p>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            padding: "6px 10px",
            background: verificationBadgeColor(status),
            color: "#ffffff",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {loading ? "Loading..." : formatVerificationStatus(status)}
        </span>
      </div>

      <div style={{ marginTop: 12, lineHeight: 1.8 }}>
        <div>
          <strong>Driver:</strong> {driverName}
        </div>
        <div>
          <strong>Verification status:</strong> {formatVerificationStatus(status)}
        </div>
        <div>
          <strong>Submitted at:</strong>{" "}
          {submittedAt ? new Date(submittedAt).toLocaleString() : "Not submitted yet"}
        </div>
        <div>
          <strong>Verified at:</strong>{" "}
          {verifiedAt ? new Date(verifiedAt).toLocaleString() : "Not verified yet"}
        </div>
        <div>
          <strong>Admin notes:</strong> {adminNotes ?? "No notes yet"}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 10,
          background: "#fefce8",
          border: "1px solid #fde68a",
          color: "#854d0e",
        }}
      >
        Documents bucket is prepared: <strong>driver-documents</strong>. File upload will be added in the next step.
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            background: "#ecfdf5",
            border: "1px solid #bbf7d0",
            color: "#047857",
          }}
        >
          {message}
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={() => {
            void handleSubmitVerification();
          }}
          disabled={loading || actionLoading || status === "approved"}
          style={buttonStyle("#2563eb", loading || actionLoading || status === "approved")}
        >
          {actionLoading
            ? "Submitting..."
            : status === "approved"
              ? "Verification Approved"
              : "Submit Verification Request"}
        </button>
      </div>
    </div>
  );
}
