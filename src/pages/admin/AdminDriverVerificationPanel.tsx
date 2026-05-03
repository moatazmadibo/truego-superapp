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

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "N/A";
}

export default function AdminDriverVerificationPanel() {
  const [rows, setRows] = useState<DemoDriverVerificationRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadRows() {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase.rpc(
      "list_demo_driver_verifications"
    );

    if (loadError) {
      setError(loadError.message);
    } else {
      const nextRows = (Array.isArray(data) ? data : []) as DemoDriverVerificationRow[];
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
            Review demo driver verification requests for Pi listing readiness.
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
