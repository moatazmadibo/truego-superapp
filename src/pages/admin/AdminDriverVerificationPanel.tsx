import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { requireAdminSessionToken } from "../../components/admin/adminSession";

type VerificationStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "rejected"
  | "needs_more_info";

type VerificationFilter =
  | "all"
  | "submitted"
  | "ready"
  | "approved"
  | "email_verified"
  | "needs_more_info";

type DocumentType =
  | "national_id"
  | "national_id_front"
  | "national_id_back"
  | "passport"
  | "driving_license"
  | "vehicle_license"
  | "vehicle_photo"
  | "profile_photo"
  | "other";

type DemoDriverVerificationRow = {
  demo_driver_id: string;
  driver_name: string;
  verification_status: VerificationStatus;
  admin_review_notes: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  updated_at: string | null;
  email_verified_at?: string | null;
  account_status?: string | null;
  onboarding_status?: string | null;
};

type DemoDriverDocumentRow = {
  id: string;
  demo_driver_id: string;
  driver_name: string;
  document_type: DocumentType;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  status: "pending" | "approved" | "rejected" | "needs_more_info";
  uploaded_at: string;
};

type DemoDriverOperationalRow = {
  id: string;
  display_name: string;
  pi_uid?: string | null;
  pi_username?: string | null;
  email?: string | null;
  phone?: string | null;
  email_verified_at?: string | null;
  phone_verified_at?: string | null;
  account_status?: string | null;
  onboarding_status?: string | null;
  vehicle_type: "car" | "motorcycle";
  is_online: boolean;
  is_available: boolean;
  rating: number;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
  vehicle_year: number | null;
  vehicle_license_expires_at: string | null;
  driver_license_expires_at?: string | null;
  profile_photo_path?: string | null;
};

const REQUIRED_DOCUMENTS: Array<{ type: DocumentType; label: string }> = [
  { type: "driving_license", label: "Driving license" },
  { type: "vehicle_license", label: "Vehicle license" },
  { type: "vehicle_photo", label: "Vehicle photo" },
  { type: "profile_photo", label: "Profile photo" },
];

function sectionStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  };
}

function cardStyle(): React.CSSProperties {
  return {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  };
}

function buttonStyle(background: string, disabled = false): React.CSSProperties {
  return {
    border: 0,
    borderRadius: 10,
    padding: "10px 12px",
    color: "#ffffff",
    background,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

function secondaryButtonStyle(disabled = false): React.CSSProperties {
  return {
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "10px 12px",
    color: "#334155",
    background: "#ffffff",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

function statStyle(): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  };
}

function statButtonStyle(active: boolean): React.CSSProperties {
  return {
    ...statStyle(),
    textAlign: "left",
    cursor: "pointer",
    background: active ? "#eff6ff" : "#f8fafc",
    border: active ? "1px solid #2563eb" : "1px solid #e5e7eb",
    color: "#111827",
  };
}


function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

function badgeColor(status: VerificationStatus) {
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

function formatStatus(status: VerificationStatus) {
  switch (status) {
    case "pending":
      return "Pending";
    case "submitted":
      return "Submitted";
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

function formatDocumentType(type: DocumentType) {
  switch (type) {
    case "national_id":
      return "National ID - legacy single-side";
    case "national_id_front":
      return "National ID - Front";
    case "national_id_back":
      return "National ID - Back";
    case "passport":
      return "Passport";
    case "driving_license":
      return "Driving license";
    case "vehicle_license":
      return "Vehicle license";
    case "vehicle_photo":
      return "Vehicle photo";
    case "profile_photo":
      return "Profile photo";
    default:
      return "Other";
  }
}

function formatVehicleType(type?: string | null) {
  switch (type) {
    case "car":
      return "Car";
    case "motorcycle":
      return "Motorcycle";
    default:
      return type ?? "Not recorded";
  }
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "N/A";
}

function formatExpiry(value?: string | null) {
  if (!value) return "Not set";

  const expiry = new Date(value);
  const today = new Date();
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (!Number.isFinite(diffDays)) return value;

  if (diffDays < 0) {
    return `${value} · expired`;
  }

  if (diffDays <= 30) {
    return `${value} · expires soon`;
  }

  return value;
}

function contactStatusLabel(value?: string | null) {
  return value ? "Verified" : "Not verified";
}

function contactStatusKind(value?: string | null): "ok" | "warning" {
  return value ? "ok" : "warning";
}

function readinessBadgeStyle(kind: "ok" | "warning" | "blocked"): React.CSSProperties {
  const palette = {
    ok: { background: "#dcfce7", color: "#166534", border: "#bbf7d0" },
    warning: { background: "#fff7ed", color: "#9a3412", border: "#fed7aa" },
    blocked: { background: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  }[kind];

  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 900,
    background: palette.background,
    color: palette.color,
    border: `1px solid ${palette.border}`,
    marginRight: 6,
    marginTop: 6,
  };
}

function detailGridStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
    marginTop: 12,
  };
}

function detailItemStyle(): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    lineHeight: 1.6,
  };
}

function verificationTimelineGridStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 10,
    marginTop: 10,
  };
}

function verificationTimelineItemStyle(): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    lineHeight: 1.5,
  };
}

function getDocumentReviewState(docs: DemoDriverDocumentRow[]) {
  const uploadedTypes = new Set(docs.map((doc) => doc.document_type));
  const hasPassport = uploadedTypes.has("passport");
  const hasNationalIdBothSides =
    uploadedTypes.has("national_id_front") &&
    uploadedTypes.has("national_id_back");
  const hasIdentityProof = hasPassport || hasNationalIdBothSides;
  const hasLegacyNationalId = uploadedTypes.has("national_id");

  const missingDocuments = REQUIRED_DOCUMENTS.filter(
    (document) => !uploadedTypes.has(document.type)
  );

  return {
    hasPassport,
    hasNationalIdBothSides,
    hasIdentityProof,
    hasLegacyNationalId,
    missingDocuments,
    canApprove: hasIdentityProof && missingDocuments.length === 0,
    checklist: [
      {
        label: "Identity proof: Passport OR National ID front and back",
        uploaded: hasIdentityProof,
      },
      ...REQUIRED_DOCUMENTS.map((document) => ({
        label: document.label,
        uploaded: uploadedTypes.has(document.type),
      })),
    ],
  };
}

function getDriverReadiness(driver?: DemoDriverOperationalRow) {
  if (!driver) {
    return {
      accountKind: "blocked" as const,
      contactKind: "warning" as const,
      profileKind: "warning" as const,
      onlineText: "Driver profile not loaded",
    };
  }

  const accountKind = driver.account_status === "approved" ? "ok" : "blocked";
  const contactKind = driver.email_verified_at && driver.phone_verified_at ? "ok" : "warning";
  const profileComplete = Boolean(
    driver.vehicle_type &&
      driver.vehicle_make &&
      driver.vehicle_model &&
      driver.vehicle_color &&
      driver.vehicle_plate
  );

  return {
    accountKind,
    contactKind,
    profileKind: profileComplete ? ("ok" as const) : ("warning" as const),
    onlineText:
      driver.account_status === "approved"
        ? "Eligible for Go Online"
        : "Go Online blocked until admin approval",
  };
}

export default function AdminDriverVerificationPanel() {
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>("all");
  const [rows, setRows] = useState<DemoDriverVerificationRow[]>([]);
  const [documentsByDriver, setDocumentsByDriver] = useState<Record<string, DemoDriverDocumentRow[]>>({});
  const [driversById, setDriversById] = useState<Record<string, DemoDriverOperationalRow>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const [openKey, setOpenKey] = useState("");
  const [documentActionKey, setDocumentActionKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function isReadyForApprovalRow(row: DemoDriverVerificationRow) {
    const docs = documentsByDriver[row.demo_driver_id] ?? [];
    return getDocumentReviewState(docs).canApprove;
  }

  function isEmailVerifiedRow(row: DemoDriverVerificationRow) {
    const driver = driversById[row.demo_driver_id];
    return Boolean(driver?.email_verified_at || row.email_verified_at);
  }

  const stats = useMemo(() => {
    const total = rows.length;
    const approved = rows.filter((row) => row.verification_status === "approved").length;
    const submitted = rows.filter((row) => row.verification_status === "submitted").length;
    const needsMoreInfo = rows.filter((row) => row.verification_status === "needs_more_info").length;
    const readyForApproval = rows.filter(isReadyForApprovalRow).length;
    const emailVerified = rows.filter(isEmailVerifiedRow).length;

    return { total, approved, submitted, needsMoreInfo, readyForApproval, emailVerified };
  }, [documentsByDriver, driversById, rows]);

  const filterLabel = {
    all: "Total",
    submitted: "Submitted",
    ready: "Ready",
    approved: "Approved",
    email_verified: "Email verified",
    needs_more_info: "Needs info",
  }[verificationFilter];

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (verificationFilter === "all") return true;
      if (verificationFilter === "submitted") return row.verification_status === "submitted";
      if (verificationFilter === "ready") return isReadyForApprovalRow(row);
      if (verificationFilter === "approved") return row.verification_status === "approved";
      if (verificationFilter === "email_verified") return isEmailVerifiedRow(row);
      if (verificationFilter === "needs_more_info") return row.verification_status === "needs_more_info";

      return true;
    });
  }, [documentsByDriver, driversById, rows, verificationFilter]);

  async function loadRows() {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("demo_driver_verifications")
      .select(
        "demo_driver_id, driver_name, verification_status, admin_review_notes, submitted_at, verified_at, updated_at"
      )
      .order("updated_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const nextRows = (data ?? []) as DemoDriverVerificationRow[];
    setRows(nextRows);

    setNotes((current) => {
      const copy = { ...current };
      for (const row of nextRows) {
        if (copy[row.demo_driver_id] == null) {
          copy[row.demo_driver_id] = row.admin_review_notes ?? "";
        }
      }
      return copy;
    });

    if (nextRows.length > 0) {
      const ids = nextRows.map((row) => row.demo_driver_id);

      const { data: docsData, error: docsError } = await supabase
        .from("demo_driver_documents")
        .select(
          "id, demo_driver_id, driver_name, document_type, file_path, file_name, mime_type, file_size, status, uploaded_at"
        )
        .in("demo_driver_id", ids)
        .order("uploaded_at", { ascending: false });

      const { data: driversData, error: driversError } = await supabase
        .from("demo_drivers")
        .select(
          [
            "id",
            "display_name",
            "pi_uid",
            "pi_username",
            "email",
            "phone",
            "email_verified_at",
            "phone_verified_at",
            "account_status",
            "onboarding_status",
            "vehicle_type",
            "is_online",
            "is_available",
            "rating",
            "vehicle_make",
            "vehicle_model",
            "vehicle_color",
            "vehicle_plate",
            "vehicle_year",
            "vehicle_license_expires_at",
            "driver_license_expires_at",
            "profile_photo_path",
          ].join(", ")
        )
        .in("id", ids);

      if (driversError) {
        setError(driversError.message);
      } else {
        const mappedDrivers: Record<string, DemoDriverOperationalRow> = {};
        for (const driver of (driversData ?? []) as unknown as DemoDriverOperationalRow[]) {
          mappedDrivers[driver.id] = driver;
        }
        setDriversById(mappedDrivers);
      }

      if (docsError) {
        setError(docsError.message);
      } else {
        const grouped: Record<string, DemoDriverDocumentRow[]> = {};
        for (const doc of (docsData ?? []) as DemoDriverDocumentRow[]) {
          grouped[doc.demo_driver_id] = grouped[doc.demo_driver_id] ?? [];
          grouped[doc.demo_driver_id].push(doc);
        }
        setDocumentsByDriver(grouped);
      }
    } else {
      setDocumentsByDriver({});
      setDriversById({});
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadRows();
  }, []);

  async function openStoragePath(filePath: string, key: string) {
    setOpenKey(key);
    setError("");

    try {
      const { data, error: signedUrlError } = await supabase.functions.invoke<{
        ok: boolean;
        signedUrl?: string;
        error?: string;
      }>("admin-driver-document-url", {
        body: {
          sessionToken: requireAdminSessionToken(),
          filePath,
          recordId: key,
        },
      });

      if (signedUrlError) {
        throw signedUrlError;
      }

      if (!data?.ok || !data.signedUrl) {
        throw new Error(data?.error ?? "Failed to open driver document.");
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (signedUrlError) {
      setError(getErrorMessage(signedUrlError, "Failed to open driver document."));
    } finally {
      setOpenKey("");
    }
  }

  async function reviewDriverDocument(
    documentId: string,
    nextStatus: DemoDriverDocumentRow["status"]
  ) {
    const actionKey = `${documentId}:${nextStatus}`;
    setDocumentActionKey(actionKey);
    setError("");

    try {
      const { data, error: reviewError } = await supabase.rpc(
        "admin_review_demo_driver_document",
        {
          p_admin_session_token: requireAdminSessionToken(),
          p_document_id: documentId,
          p_status: nextStatus,
          p_admin_notes: `Admin changed document status to ${nextStatus}.`,
        }
      );

      if (reviewError) {
        throw reviewError;
      }

      const updatedDocument = data as unknown as DemoDriverDocumentRow;

      setDocumentsByDriver((previous) => {
        const next: Record<string, DemoDriverDocumentRow[]> = {};

        for (const [driverId, documents] of Object.entries(previous)) {
          next[driverId] = documents.map((document) =>
            document.id === documentId
              ? {
                  ...document,
                  status: updatedDocument.status ?? nextStatus,
                }
              : document
          );
        }

        return next;
      });
    } catch (reviewError) {
      setError(getErrorMessage(reviewError, "Failed to review driver document."));
    } finally {
      setDocumentActionKey("");
    }
  }


  async function reviewDriver(row: DemoDriverVerificationRow, nextStatus: VerificationStatus) {
    setActionKey(`${row.demo_driver_id}:${nextStatus}`);
    setError("");
    setMessage("");

    const { error: reviewError } = await supabase.rpc("admin_review_demo_driver_verification", {
      p_admin_session_token: requireAdminSessionToken(),
      p_demo_driver_id: row.demo_driver_id,
      p_verification_status: nextStatus,
      p_admin_review_notes: notes[row.demo_driver_id] || null,
    });

    if (reviewError) {
      setError(getErrorMessage(reviewError, "Failed to review driver verification."));
    } else {
      setMessage(`${row.driver_name} marked as ${formatStatus(nextStatus)}.`);
      await loadRows();
    }

    setActionKey("");
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
          <h2 style={{ margin: 0 }}>Driver Verification Review</h2>
          <p style={{ margin: "6px 0 0", color: "#475569" }}>
            Review Pi account, contact verification, identity, license, vehicle documents, and approval readiness.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadRows();
          }}
          disabled={loading}
          style={buttonStyle("#334155", loading)}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginTop: 14,
        }}
      >
        <button type="button" onClick={() => setVerificationFilter("all")} style={statButtonStyle(verificationFilter === "all")}><strong>Total</strong><div>{stats.total}</div></button>
        <button type="button" onClick={() => setVerificationFilter("submitted")} style={statButtonStyle(verificationFilter === "submitted")}><strong>Submitted</strong><div>{stats.submitted}</div></button>
        <button type="button" onClick={() => setVerificationFilter("ready")} style={statButtonStyle(verificationFilter === "ready")}><strong>Ready</strong><div>{stats.readyForApproval}</div></button>
        <button type="button" onClick={() => setVerificationFilter("approved")} style={statButtonStyle(verificationFilter === "approved")}><strong>Approved</strong><div>{stats.approved}</div></button>
        <button type="button" onClick={() => setVerificationFilter("email_verified")} style={statButtonStyle(verificationFilter === "email_verified")}><strong>Email verified</strong><div>{stats.emailVerified}</div></button>
        <button type="button" onClick={() => setVerificationFilter("needs_more_info")} style={statButtonStyle(verificationFilter === "needs_more_info")}><strong>Needs info</strong><div>{stats.needsMoreInfo}</div></button>
      </div>

      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ color: "#64748b" }}>
          Showing filter: <strong>{filterLabel}</strong> · {filteredRows.length} driver(s)
        </span>
        {verificationFilter !== "all" ? (
          <button
            type="button"
            onClick={() => setVerificationFilter("all")}
            style={secondaryButtonStyle()}
          >
            Clear filter
          </button>
        ) : null}


      {error ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
          {error}
        </div>
      ) : null}

      {message ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#047857" }}>
          {message}
        </div>
      ) : null}

      {!loading && rows.length === 0 ? (
        <p style={{ color: "#64748b" }}>No driver verification requests yet.</p>
      ) : null}
      </div>

      {filteredRows.map((row) => {
        const driver = driversById[row.demo_driver_id];
        const readiness = getDriverReadiness(driver);
        const isActionLoading = actionKey.startsWith(`${row.demo_driver_id}:`);
        const docs = documentsByDriver[row.demo_driver_id] ?? [];
        const reviewState = getDocumentReviewState(docs);
        const approvedButDocumentsIncomplete =
          row.verification_status === "approved" && !reviewState.canApprove;
        const isAlreadyApproved = row.verification_status === "approved";
        const approveDisabled =
          isActionLoading || !reviewState.canApprove || isAlreadyApproved;

        return (
          <div key={row.demo_driver_id} style={cardStyle()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div><strong>Driver:</strong> {row.driver_name}</div>
                <div><strong>Driver profile ID:</strong> {row.demo_driver_id}</div>

                <div style={{ marginTop: 8 }}>
                  <span style={readinessBadgeStyle(readiness.accountKind as "ok" | "warning" | "blocked")}>
                    {driver?.account_status === "approved" ? "Account approved" : "Account not approved"}
                  </span>
                  <span style={readinessBadgeStyle(readiness.contactKind as "ok" | "warning" | "blocked")}>
                    {driver?.email_verified_at && driver?.phone_verified_at
                      ? "Contacts verified"
                      : "Contact verification pending"}
                  </span>
                  <span style={readinessBadgeStyle(readiness.profileKind as "ok" | "warning" | "blocked")}>
                    {readiness.profileKind === "ok" ? "Vehicle profile ready" : "Vehicle profile incomplete"}
                  </span>
                </div>

                <div style={{ marginTop: 8, color: driver?.account_status === "approved" ? "#047857" : "#9a3412" }}>
                  <strong>Go Online:</strong> {readiness.onlineText}
                </div>
              </div>

              <span
                style={{
                  borderRadius: 999,
                  padding: "6px 10px",
                  background: badgeColor(row.verification_status),
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {formatStatus(row.verification_status)}
              </span>
            </div>

            <div style={detailGridStyle()}>
              <div style={detailItemStyle()}>
                <strong>Pi account</strong>
                <div style={{ marginTop: 6 }}>
                  {driver?.pi_username ? `@${driver.pi_username}` : "Not linked"}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  UID: {driver?.pi_uid ?? "Not linked"}
                </div>
              </div>

              <div style={detailItemStyle()}>
                <strong>Email</strong>
                <div style={{ marginTop: 6 }}>{driver?.email ?? "Not provided"}</div>
                <span style={readinessBadgeStyle(contactStatusKind(driver?.email_verified_at))}>
                  {contactStatusLabel(driver?.email_verified_at)}
                </span>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  {formatDate(driver?.email_verified_at)}
                </div>
              </div>

              <div style={detailItemStyle()}>
                <strong>Phone</strong>
                <div style={{ marginTop: 6 }}>{driver?.phone ?? "Not provided"}</div>
                <span style={readinessBadgeStyle(contactStatusKind(driver?.phone_verified_at))}>
                  {contactStatusLabel(driver?.phone_verified_at)}
                </span>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  {formatDate(driver?.phone_verified_at)}
                </div>
              </div>

              <div style={detailItemStyle()}>
                <strong>Account / onboarding</strong>
                <div>
                  <span style={readinessBadgeStyle(driver?.account_status === "approved" ? "ok" : "blocked")}>
                    {driver?.account_status ?? "pending"}
                  </span>
                  <span style={readinessBadgeStyle(driver?.onboarding_status === "approved" ? "ok" : "warning")}>
                    {driver?.onboarding_status ?? "profile_required"}
                  </span>
                </div>
              </div>

              <div style={detailItemStyle()}>
                <strong>Operational status</strong>
                <div style={{ marginTop: 6 }}>
                  {driver?.is_online ? "Online" : "Offline"} / {driver?.is_available ? "Available" : "Busy"}
                </div>
                <div>Rating: {driver?.rating != null ? driver.rating.toFixed(1) : "N/A"}</div>
              </div>

              <div style={detailItemStyle()}>
                <strong>Vehicle</strong>
                <div style={{ marginTop: 6 }}>
                  {formatVehicleType(driver?.vehicle_type)}
                </div>
                <div>
                  {[driver?.vehicle_make, driver?.vehicle_model, driver?.vehicle_year, driver?.vehicle_color]
                    .filter(Boolean)
                    .join(" ") || "Not completed"}
                </div>
                <div>Plate: {driver?.vehicle_plate ?? "Not set"}</div>
              </div>

              <div style={detailItemStyle()}>
                <strong>License expiry</strong>
                <div style={{ marginTop: 6 }}>
                  Vehicle: {formatExpiry(driver?.vehicle_license_expires_at)}
                </div>
                <div>
                  Driver: {formatExpiry(driver?.driver_license_expires_at)}
                </div>
              </div>

              <div style={detailItemStyle()}>
                <strong>Profile photo</strong>
                <div style={{ marginTop: 6 }}>
                  {driver?.profile_photo_path ? "Linked" : "Not uploaded"}
                </div>
                {driver?.profile_photo_path ? (
                  <button
                    type="button"
                    onClick={() => {
                      void openStoragePath(driver.profile_photo_path ?? "", `${driver.id}:profile_photo`);
                    }}
                    disabled={openKey === `${driver.id}:profile_photo`}
                    style={{ ...secondaryButtonStyle(openKey === `${driver.id}:profile_photo`), marginTop: 8 }}
                  >
                    {openKey === `${driver.id}:profile_photo` ? "Opening..." : "Open profile photo"}
                  </button>
                ) : null}
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                background: "#ffffff",
                border: "1px solid #e5e7eb",
              }}
            >
              <strong>Verification operation timeline</strong>
              <div style={verificationTimelineGridStyle()}>
                <div style={verificationTimelineItemStyle()}>
                  <strong>Submitted at</strong>
                  <div style={{ marginTop: 6 }}>{formatDate(row.submitted_at)}</div>
                </div>

                <div style={verificationTimelineItemStyle()}>
                  <strong>Approved / verified at</strong>
                  <div style={{ marginTop: 6 }}>{formatDate(row.verified_at)}</div>
                </div>

                <div style={verificationTimelineItemStyle()}>
                  <strong>Last review update</strong>
                  <div style={{ marginTop: 6 }}>{formatDate(row.updated_at)}</div>
                </div>
              </div>
            </div>

            {approvedButDocumentsIncomplete ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  color: "#9a3412",
                }}
              >
                This driver was approved before the latest required-document policy. Ask the driver for missing documents or mark as Needs more info.
              </div>
            ) : null}

            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: reviewState.canApprove ? "#ecfdf5" : "#fff7ed",
                border: reviewState.canApprove ? "1px solid #bbf7d0" : "1px solid #fed7aa",
                color: reviewState.canApprove ? "#047857" : "#9a3412",
              }}
            >
              <strong>Required documents</strong>
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                {reviewState.checklist.map((item) => (
                  <div key={item.label}>
                    {item.uploaded ? "✓" : "○"} {item.label}
                  </div>
                ))}
              </div>

              {reviewState.hasLegacyNationalId && !reviewState.hasIdentityProof ? (
                <div style={{ marginTop: 10 }}>
                  Legacy National ID upload is stored, but it is not counted for final approval. The driver must upload Passport or both National ID sides.
                </div>
              ) : null}
            </div>

            {docs.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <strong>Uploaded documents</strong>
                {docs.map((document) => {
                  const isLegacyIdentity = document.document_type === "national_id";

                  return (
                    <div
                      key={document.id}
                      style={{
                        marginTop: 8,
                        padding: 10,
                        borderRadius: 10,
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        lineHeight: 1.7,
                      }}
                    >
                      <div><strong>Type:</strong> {formatDocumentType(document.document_type)}</div>
                      <div><strong>File:</strong> {document.file_name ?? document.file_path}</div>
                      <div><strong>Status:</strong> {document.status}</div>
                      <div><strong>Uploaded at:</strong> {formatDate(document.uploaded_at)}</div>

                      {isLegacyIdentity ? (
                        <div style={{ marginTop: 6, color: "#9a3412" }}>
                          Legacy single-side National ID. Not counted for final approval.
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => {
                          void openStoragePath(document.file_path, document.id);
                        }}
                        disabled={openKey === document.id}
                        style={{ ...buttonStyle("#0f766e", openKey === document.id), marginTop: 8 }}
                      >
                        {openKey === document.id ? "Opening..." : "Open document"}
                      </button>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          marginTop: 8,
                        }}
                      >
                        {([
                          ["approved", "Approve document", "#16a34a"],
                          ["needs_more_info", "Needs info", "#f59e0b"],
                          ["rejected", "Reject document", "#dc2626"],
                        ] as const).map(([status, label, color]) => {
                          const actionKey = `${document.id}:${status}`;
                          const disabled =
                            documentActionKey !== "" || document.status === status;

                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={() => {
                                void reviewDriverDocument(document.id, status);
                              }}
                              disabled={disabled}
                              style={{
                                ...buttonStyle(color, disabled),
                                marginTop: 0,
                              }}
                            >
                              {documentActionKey === actionKey ? "Saving..." : label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <label style={{ display: "block", marginTop: 12, fontWeight: 700 }}>
              Admin notes
            </label>
            <textarea
              value={notes[row.demo_driver_id] ?? ""}
              onChange={(event) => {
                setNotes((current) => ({
                  ...current,
                  [row.demo_driver_id]: event.target.value,
                }));
              }}
              rows={3}
              style={{
                width: "100%",
                marginTop: 6,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                padding: 10,
                font: "inherit",
                boxSizing: "border-box",
              }}
              placeholder="Write review notes for this driver..."
            />

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  void reviewDriver(row, "approved");
                }}
                disabled={approveDisabled}
                title={
                  isAlreadyApproved
                    ? "Driver is already approved."
                    : !reviewState.canApprove
                      ? "Upload all required documents before approval."
                      : undefined
                }
                style={buttonStyle("#16a34a", approveDisabled)}
              >
                {isAlreadyApproved ? "Approved" : "Approve"}
              </button>

              <button
                type="button"
                onClick={() => {
                  void reviewDriver(row, "needs_more_info");
                }}
                disabled={isActionLoading}
                style={buttonStyle("#d97706", isActionLoading)}
              >
                Needs more info
              </button>

              <button
                type="button"
                onClick={() => {
                  void reviewDriver(row, "rejected");
                }}
                disabled={isActionLoading}
                style={buttonStyle("#dc2626", isActionLoading)}
              >
                Reject
              </button>
            </div>

            {isAlreadyApproved ? (
              <p style={{ marginBottom: 0, color: "#047857" }}>
                Driver is already approved. Approval button is disabled unless the driver is moved back to review.
              </p>
            ) : null}

            {!reviewState.canApprove ? (
              <p style={{ marginBottom: 0, color: "#9a3412" }}>
                Approval is blocked until all required documents are uploaded.
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}