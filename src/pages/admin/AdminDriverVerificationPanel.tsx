import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type VerificationStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "rejected"
  | "needs_more_info";

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
  document_type: string;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  status: string;
  uploaded_at: string;
};

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

function badgeColor(status: VerificationStatus | string) {
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

function formatDocumentType(type: string) {
  switch (type) {
    case "national_id":
      return "National ID";
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

function formatFileSize(size: number | null) {
  if (!size) return "N/A";

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export default function AdminDriverVerificationPanel() {
  const [rows, setRows] = useState<DemoDriverVerificationRow[]>([]);
  const [documents, setDocuments] = useState<Record<string, DemoDriverDocumentRow[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const [openingPath, setOpeningPath] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadDocuments(driverIds: string[]) {
    if (driverIds.length === 0) {
      setDocuments({});
      return;
    }

    const { data, error: documentsError } = await supabase
      .from("demo_driver_documents")
      .select(
        "id, demo_driver_id, driver_name, document_type, file_path, file_name, mime_type, file_size, status, uploaded_at"
      )
      .in("demo_driver_id", driverIds)
      .order("uploaded_at", { ascending: false });

    if (documentsError) {
      setError(documentsError.message);
      return;
    }

    const grouped: Record<string, DemoDriverDocumentRow[]> = {};

    for (const document of (data ?? []) as DemoDriverDocumentRow[]) {
      if (!grouped[document.demo_driver_id]) {
        grouped[document.demo_driver_id] = [];
      }

      grouped[document.demo_driver_id].push(document);
    }

    setDocuments(grouped);
  }

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
    } else {
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

      await loadDocuments(nextRows.map((row) => row.demo_driver_id));
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadRows();
  }, []);

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

  async function openDocument(document: DemoDriverDocumentRow) {
    setOpeningPath(document.file_path);
    setError("");

    const { data, error: signedUrlError } = await supabase.storage
      .from("driver-documents")
      .createSignedUrl(document.file_path, 60 * 5);

    if (signedUrlError || !data?.signedUrl) {
      setError(signedUrlError?.message ?? "Could not open document.");
    } else {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }

    setOpeningPath("");
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
            Review demo driver verification requests and uploaded documents for Pi listing readiness.
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

      {!loading && rows.length === 0 ? (
        <p style={{ color: "#64748b" }}>No driver verification requests yet.</p>
      ) : null}

      {rows.map((row) => {
        const isActionLoading = actionKey.startsWith(`${row.demo_driver_id}:`);
        const driverDocuments = documents[row.demo_driver_id] ?? [];

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
                <div>
                  <strong>Driver:</strong> {row.driver_name}
                </div>
                <div>
                  <strong>Demo driver ID:</strong> {row.demo_driver_id}
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

            <div style={{ marginTop: 10, lineHeight: 1.7 }}>
              <div>
                <strong>Submitted at:</strong> {formatDate(row.submitted_at)}
              </div>
              <div>
                <strong>Verified at:</strong> {formatDate(row.verified_at)}
              </div>
              <div>
                <strong>Updated at:</strong> {formatDate(row.updated_at)}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <h3 style={{ marginBottom: 8 }}>Uploaded documents</h3>

              {driverDocuments.length === 0 ? (
                <p style={{ color: "#64748b" }}>No documents uploaded yet.</p>
              ) : (
                driverDocuments.map((document) => (
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
                    <div>
                      <strong>Type:</strong> {formatDocumentType(document.document_type)}
                    </div>
                    <div>
                      <strong>File:</strong> {document.file_name ?? document.file_path}
                    </div>
                    <div>
                      <strong>Size:</strong> {formatFileSize(document.file_size)}
                    </div>
                    <div>
                      <strong>Status:</strong>{" "}
                      <span
                        style={{
                          borderRadius: 999,
                          padding: "3px 8px",
                          background: badgeColor(document.status),
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {document.status}
                      </span>
                    </div>
                    <div>
                      <strong>Uploaded:</strong> {formatDate(document.uploaded_at)}
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          void openDocument(document);
                        }}
                        disabled={openingPath === document.file_path}
                        style={buttonStyle("#0f766e", openingPath === document.file_path)}
                      >
                        {openingPath === document.file_path ? "Opening..." : "Open Document"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

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

            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  void reviewDriver(row, "approved");
                }}
                disabled={isActionLoading}
                style={buttonStyle("#16a34a", isActionLoading)}
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
          </div>
        );
      })}
    </div>
  );
}
