import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type VerificationStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "rejected"
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

function statStyle(): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  };
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

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "N/A";
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

export default function AdminDriverVerificationPanel() {
  const [rows, setRows] = useState<DemoDriverVerificationRow[]>([]);
  const [documentsByDriver, setDocumentsByDriver] = useState<Record<string, DemoDriverDocumentRow[]>>({});
  const [driversById, setDriversById] = useState<Record<string, DemoDriverOperationalRow>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const [openKey, setOpenKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const stats = useMemo(() => {
    const total = rows.length;
    const approved = rows.filter((row) => row.verification_status === "approved").length;
    const submitted = rows.filter((row) => row.verification_status === "submitted").length;
    const needsMoreInfo = rows.filter((row) => row.verification_status === "needs_more_info").length;
    const readyForApproval = rows.filter((row) => {
      const docs = documentsByDriver[row.demo_driver_id] ?? [];
      return getDocumentReviewState(docs).canApprove;
    }).length;

    return { total, approved, submitted, needsMoreInfo, readyForApproval };
  }, [documentsByDriver, rows]);

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
        .select("id, demo_driver_id, driver_name, document_type, file_path, file_name, mime_type, file_size, status, uploaded_at")
        .in("demo_driver_id", ids)
        .order("uploaded_at", { ascending: false });

      const { data: driversData, error: driversError } = await supabase
        .from("demo_drivers")
        .select("id, display_name, vehicle_type, is_online, is_available, rating, vehicle_make, vehicle_model, vehicle_color, vehicle_plate, vehicle_year, vehicle_license_expires_at")
        .in("id", ids);

      if (driversError) {
        setError(driversError.message);
      } else {
        const mappedDrivers: Record<string, DemoDriverOperationalRow> = {};
        for (const driver of (driversData ?? []) as DemoDriverOperationalRow[]) {
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

  async function openDocument(document: DemoDriverDocumentRow) {
    setOpenKey(document.id);
    setError("");

    const { data, error: signedUrlError } = await supabase.storage
      .from("driver-documents")
      .createSignedUrl(document.file_path, 3600);

    if (signedUrlError) {
      setError(signedUrlError.message);
    } else if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }

    setOpenKey("");
  }

  async function reviewDriver(row: DemoDriverVerificationRow, nextStatus: VerificationStatus) {
    setActionKey(`${row.demo_driver_id}:${nextStatus}`);
    setError("");
    setMessage("");

    const { error: reviewError } = await supabase.rpc("review_demo_driver_verification", {
      p_demo_driver_id: row.demo_driver_id,
      p_verification_status: nextStatus,
      p_admin_review_notes: notes[row.demo_driver_id] || null,
    });

    if (reviewError) {
      setError(reviewError.message);
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
            Review driver identity, license, vehicle documents, and approval readiness in a separate workflow from rides.
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
        <div style={statStyle()}><strong>Total</strong><div>{stats.total}</div></div>
        <div style={statStyle()}><strong>Submitted</strong><div>{stats.submitted}</div></div>
        <div style={statStyle()}><strong>Ready</strong><div>{stats.readyForApproval}</div></div>
        <div style={statStyle()}><strong>Approved</strong><div>{stats.approved}</div></div>
        <div style={statStyle()}><strong>Needs info</strong><div>{stats.needsMoreInfo}</div></div>
      </div>

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

      {rows.map((row) => {
        const isActionLoading = actionKey.startsWith(`${row.demo_driver_id}:`);
        const docs = documentsByDriver[row.demo_driver_id] ?? [];
        const reviewState = getDocumentReviewState(docs);
        const approvedButDocumentsIncomplete =
          row.verification_status === "approved" && !reviewState.canApprove;

        return (
          <div key={row.demo_driver_id} style={cardStyle()}>
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
                <div><strong>Driver:</strong> {row.driver_name}</div>
                <div><strong>Demo driver ID:</strong> {row.demo_driver_id}</div>
                <div>
                  <strong>Vehicle:</strong>{" "}
                  {driversById[row.demo_driver_id]?.vehicle_type ?? "Not recorded"}
                </div>
                <div>
                  <strong>Rating:</strong>{" "}
                  {driversById[row.demo_driver_id]?.rating != null
                    ? driversById[row.demo_driver_id].rating.toFixed(1)
                    : "N/A"}
                </div>
                <div>
                  <strong>Operational status:</strong>{" "}
                  {driversById[row.demo_driver_id]?.is_online ? "Online" : "Offline"} /{" "}
                  {driversById[row.demo_driver_id]?.is_available ? "Available" : "Busy"}
                </div>
                <div>
                  <strong>Vehicle profile:</strong>{" "}
                  {[
                    driversById[row.demo_driver_id]?.vehicle_make,
                    driversById[row.demo_driver_id]?.vehicle_model,
                    driversById[row.demo_driver_id]?.vehicle_year,
                    driversById[row.demo_driver_id]?.vehicle_color,
                  ]
                    .filter(Boolean)
                    .join(" ") || "Not completed"}
                </div>
                <div>
                  <strong>Plate number:</strong>{" "}
                  {driversById[row.demo_driver_id]?.vehicle_plate ?? "Not set"}
                </div>
                <div>
                  <strong>Vehicle license expiry:</strong>{" "}
                  {driversById[row.demo_driver_id]?.vehicle_license_expires_at ?? "Not set"}
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
                          void openDocument(document);
                        }}
                        disabled={openKey === document.id}
                        style={{ ...buttonStyle("#0f766e", openKey === document.id), marginTop: 8 }}
                      >
                        {openKey === document.id ? "Opening..." : "Open document"}
                      </button>
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
                disabled={isActionLoading || !reviewState.canApprove}
                title={!reviewState.canApprove ? "Upload all required documents before approval." : undefined}
                style={buttonStyle("#16a34a", isActionLoading || !reviewState.canApprove)}
              >
                Approve
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
