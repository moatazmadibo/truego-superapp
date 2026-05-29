import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { DemoDriverRow } from "../../services/rideApi";

type DriverVerificationStatus =
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

type VerificationRow = {
  demo_driver_id?: string;
  driver_name?: string;
  verification_status?: DriverVerificationStatus;
  admin_review_notes?: string | null;
  submitted_at?: string | null;
  verified_at?: string | null;
  updated_at?: string | null;
};

type DriverDocumentRow = {
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

const REQUIRED_DOCUMENTS: Array<{ type: DocumentType; label: string }> = [
  { type: "driving_license", label: "Driving license" },
  { type: "vehicle_license", label: "Vehicle license" },
  { type: "vehicle_photo", label: "Vehicle photo" },
  { type: "profile_photo", label: "Profile photo" },
];

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
      return "Submitted";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "needs_more_info":
      return "Needs more informationrmation";
    default:
      return status;
  }
}

function formatDocumentType(type: DocumentType) {
  switch (type) {
    case "national_id":
      return "National ID";
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

function getDocumentReadiness(documents: DriverDocumentRow[]) {
  const uploadedDocumentTypes = new Set(documents.map((document) => document.document_type));
  const hasPassport = uploadedDocumentTypes.has("passport");
  const hasNationalIdBothSides =
    uploadedDocumentTypes.has("national_id_front") &&
    uploadedDocumentTypes.has("national_id_back");
  const hasIdentityProof = hasPassport || hasNationalIdBothSides;
  const hasLegacyNationalId = uploadedDocumentTypes.has("national_id");

  const missingRequiredDocuments = REQUIRED_DOCUMENTS.filter(
    (document) => !uploadedDocumentTypes.has(document.type)
  );

  const checklist = [
    {
      label: "Identity proof: Passport OR National ID front and back",
      uploaded: hasIdentityProof,
    },
    ...REQUIRED_DOCUMENTS.map((document) => ({
      label: document.label,
      uploaded: uploadedDocumentTypes.has(document.type),
    })),
  ];

  return {
    hasPassport,
    hasNationalIdBothSides,
    hasIdentityProof,
    hasLegacyNationalId,
    missingRequiredDocuments,
    checklist,
    verificationReady: hasIdentityProof && missingRequiredDocuments.length === 0,
  };
}

export default function DriverVerificationCard({ driver }: { driver: DemoDriverRow }) {
  const driverName = getDriverDisplayName(driver);

  const [status, setStatus] = useState<DriverVerificationStatus>("pending");
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DriverDocumentRow[]>([]);
  const [documentType, setDocumentType] = useState<DocumentType>("passport");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const readiness = getDocumentReadiness(documents);
  const approvedButDocumentsIncomplete = status === "approved" && !readiness.verificationReady;

  function applyVerificationRow(row: VerificationRow | null | undefined) {
    if (!row) return;

    setStatus((row.verification_status ?? "pending") as DriverVerificationStatus);
    setVerifiedAt(row.verified_at ?? null);
    setSubmittedAt(row.submitted_at ?? null);
    setAdminNotes(row.admin_review_notes ?? null);
  }

  async function loadDocuments() {
    const { data, error: documentsError } = await supabase
      .from("demo_driver_documents")
      .select("id, demo_driver_id, driver_name, document_type, file_path, file_name, mime_type, file_size, status, uploaded_at")
      .eq("demo_driver_id", driver.id)
      .order("uploaded_at", { ascending: false });

    if (documentsError) {
      setError(documentsError.message);
    } else {
      setDocuments((data ?? []) as DriverDocumentRow[]);
    }
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
        await loadDocuments();
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

  async function handleUploadDocument() {
    if (!selectedFile) {
      setError("Please select a document file first.");
      return;
    }

    setUploadLoading(true);
    setError("");
    setMessage("");

    const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${driver.id}/${documentType}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("driver-documents")
      .upload(filePath, selectedFile, {
        cacheControl: "3600",
        upsert: true,
        contentType: selectedFile.type || undefined,
      });

    if (uploadError) {
      setError(uploadError.message);
      setUploadLoading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("demo_driver_documents")
      .insert({
        demo_driver_id: driver.id,
        driver_name: driverName,
        document_type: documentType,
        file_path: filePath,
        file_name: selectedFile.name,
        mime_type: selectedFile.type || null,
        file_size: selectedFile.size,
        status: "pending",
      });

    if (insertError) {
      setError(insertError.message);
    } else {
      if (documentType === "profile_photo") {
        await supabase
          .from("demo_drivers")
          .update({
            profile_photo_path: filePath,
            updated_at: new Date().toISOString(),
          })
          .eq("id", driver.id);
      }

      setSelectedFile(null);
      setMessage(
        documentType === "profile_photo"
          ? "Profile photo uploaded and linked to driver profile."
          : "Document uploaded successfully."
      );
      await loadDocuments();
    }

    setUploadLoading(false);
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
            Upload required documents one by one. Admin approval is only available after the document checklist is complete.
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
        <div><strong>Driver:</strong> {driverName}</div>
        <div><strong>Verification status:</strong> {formatVerificationStatus(status)}</div>
        <div><strong>Submitted at:</strong> {submittedAt ? new Date(submittedAt).toLocaleString() : "Not submitted yet"}</div>
        <div><strong>Verified at:</strong> {verifiedAt ? new Date(verifiedAt).toLocaleString() : "Not verified yet"}</div>
        <div><strong>Admin notes:</strong> {adminNotes ?? "No notes yet"}</div>
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
          This driver was approved before the latest required-document policy. Please upload the missing documents to keep the verification record complete.
        </div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 12,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Required documents checklist</h3>

        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: readiness.verificationReady ? "#ecfdf5" : "#fff7ed",
            border: readiness.verificationReady ? "1px solid #bbf7d0" : "1px solid #fed7aa",
            color: readiness.verificationReady ? "#047857" : "#9a3412",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            {readiness.checklist.map((item) => (
              <div key={item.label}>
                {item.uploaded ? "✓" : "○"} {item.label}
              </div>
            ))}
          </div>

          {readiness.hasLegacyNationalId && !readiness.hasIdentityProof ? (
            <div style={{ marginTop: 10 }}>
              Legacy National ID upload is stored, but it is not counted for final approval. Upload Passport or both National ID sides.
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 12,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Upload driver documents</h3>

        <label style={{ display: "block", fontWeight: 700 }}>Document type</label>
        <select
          value={documentType}
          onChange={(event) => setDocumentType(event.target.value as DocumentType)}
          style={{
            width: "100%",
            marginTop: 6,
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            padding: 10,
            font: "inherit",
          }}
        >
          <option value="passport">Passport</option>
          <option value="national_id_front">National ID - Front</option>
          <option value="national_id_back">National ID - Back</option>
          <option value="driving_license">Driving license</option>
          <option value="vehicle_license">Vehicle license</option>
          <option value="vehicle_photo">Vehicle photo</option>
          <option value="profile_photo">Profile photo</option>
          <option value="other">Other</option>
        </select>

        <label style={{ display: "block", marginTop: 12, fontWeight: 700 }}>File</label>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(event) => {
            setSelectedFile(event.target.files?.[0] ?? null);
          }}
          style={{ marginTop: 8, width: "100%" }}
        />

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => {
              void handleUploadDocument();
            }}
            disabled={uploadLoading}
            style={buttonStyle("#0f766e", uploadLoading)}
          >
            {uploadLoading ? "Uploading..." : "Upload Document"}
          </button>
        </div>
      </div>

      {documents.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <h3>Uploaded documents</h3>
          {documents.map((document) => {
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
                <div><strong>Uploaded:</strong> {new Date(document.uploaded_at).toLocaleString()}</div>

                {isLegacyIdentity ? (
                  <div style={{ marginTop: 6, color: "#9a3412" }}>
                    Legacy single-side National ID upload. Not counted for final approval.
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
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

      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={() => {
            void handleSubmitVerification();
          }}
          disabled={loading || actionLoading || status === "approved" || !readiness.verificationReady}
          style={buttonStyle("#2563eb", loading || actionLoading || status === "approved" || !readiness.verificationReady)}
        >
          {actionLoading
            ? "Submitting..."
            : status === "approved"
              ? "Verification Approved"
              : readiness.verificationReady
                ? "Submit Verification Request"
                : "Complete documents to submit"}
        </button>
      </div>
    </div>
  );
}
