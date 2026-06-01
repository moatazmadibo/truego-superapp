import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";
import { formatPiAmount } from "../../lib/piPricing";

type ReportTab = "overview" | "drivers" | "rides" | "payments" | "exceptions";

type DriverReportFilter =
  | "all"
  | "verified"
  | "not_verified"
  | "needs_review"
  | "pi_linked"
  | "missing_pi";

type RideReportFilter =
  | "all"
  | "active"
  | "completed"
  | "no_driver_available"
  | "offers_expired"
  | "cancelled";

type PaymentReportFilter =
  | "all"
  | "paid"
  | "completed_paid"
  | "completed_unpaid"
  | "payout_generated"
  | "payout_pending";

type DriverReportRow = {
  demo_driver_id: string;
  display_name: string;
  pi_uid: string | null;
  pi_username: string | null;
  email: string | null;
  phone: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  account_status: string | null;
  onboarding_status: string | null;
  verification_status: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  is_online: boolean;
  is_available: boolean;
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  vehicle_license_expires_at: string | null;
  driver_license_expires_at: string | null;
  documents_count: number | string;
  approved_documents_count: number | string;
  pending_documents_count: number | string;
  readiness_status: string;
};

type RideReportRow = {
  ride_id: string;
  ride_status: string;
  payment_status: string;
  payout_status: string;
  rider_name: string | null;
  driver_name: string | null;
  demo_driver_id: string | null;
  pickup_text: string;
  destination_text: string;
  vehicle_type: string | null;
  distance_km: number | string;
  duration_min: number | string;
  price_pi: number | string | null;
  payment_amount_pi: number | string | null;
  driver_payout_pi: number | string | null;
  payment_id: string | null;
  payment_txid: string | null;
  created_at: string;
  completed_at: string | null;
  payment_completed_at: string | null;
  report_bucket: string;
};

function sectionStyle(): CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  };
}

function cardStyle(): CSSProperties {
  return {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  };
}

function gridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))",
    gap: 10,
    marginTop: 12,
  };
}

function itemStyle(): CSSProperties {
  return {
    padding: 12,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    lineHeight: 1.5,
  };
}

function buttonStyle(disabled = false): CSSProperties {
  return {
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "10px 14px",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

function activeButtonStyle(active: boolean): CSSProperties {
  return {
    ...buttonStyle(false),
    background: active ? "#111827" : "#ffffff",
    color: active ? "#ffffff" : "#111827",
    boxShadow: active ? "0 8px 20px rgba(15, 23, 42, 0.18)" : undefined,
  };
}

function badgeStyle(background: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    background,
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 12,
  };
}

function tableStyle(): CSSProperties {
  return {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  };
}

function thStyle(): CSSProperties {
  return {
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    padding: 8,
    whiteSpace: "nowrap",
  };
}

function tdStyle(): CSSProperties {
  return {
    padding: 8,
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
  };
}

function monoStyle(): CSSProperties {
  return {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    color: "#334155",
    wordBreak: "break-all",
  };
}

function dbNumber(value?: number | string | null) {
  return Number(value ?? 0);
}

function formatPi(value?: number | string | null) {
  return formatPiAmount(dbNumber(value));
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "N/A";
}

function formatDriverStatus(row: DriverReportRow) {
  switch (row.readiness_status) {
    case "verified":
      return "Verified";
    case "needs_review":
      return "Needs review";
    case "verification_approved_account_pending":
      return "Verification approved / account pending";
    default:
      return "Not verified";
  }
}

function driverBadgeColor(row: DriverReportRow) {
  switch (row.readiness_status) {
    case "verified":
      return "#16a34a";
    case "needs_review":
      return "#f59e0b";
    case "verification_approved_account_pending":
      return "#7c3aed";
    default:
      return "#64748b";
  }
}

function rideBadgeColor(row: RideReportRow) {
  switch (row.report_bucket) {
    case "completed_paid":
      return "#16a34a";
    case "completed_unpaid":
      return "#f59e0b";
    case "active":
      return "#2563eb";
    case "no_driver_available":
    case "offers_expired":
      return "#dc2626";
    case "cancelled":
      return "#991b1b";
    default:
      return "#64748b";
  }
}

function isRideException(row: RideReportRow) {
  return ["completed_unpaid", "no_driver_available", "offers_expired", "cancelled"].includes(
    row.report_bucket
  );
}

export default function AdminReportsPanel() {
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>("overview");
  const [drivers, setDrivers] = useState<DriverReportRow[]>([]);
  const [rides, setRides] = useState<RideReportRow[]>([]);
  const [driverFilter, setDriverFilter] = useState<DriverReportFilter>("all");
  const [rideFilter, setRideFilter] = useState<RideReportFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentReportFilter>("all");
  const [fromDate, setFromDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadReports() {
    setLoading(true);
    setError("");

    try {
      const [driverResult, rideResult] = await Promise.all([
        supabase.rpc("get_admin_driver_report"),
        supabase.rpc("get_admin_ride_report", {
          p_from_date: fromDate || null,
          p_to_date: toDate || null,
        }),
      ]);

      if (driverResult.error) throw driverResult.error;
      if (rideResult.error) throw rideResult.error;

      setDrivers((driverResult.data ?? []) as unknown as DriverReportRow[]);
      setRides((rideResult.data ?? []) as unknown as RideReportRow[]);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load reports.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      if (driverFilter === "verified") return driver.readiness_status === "verified";
      if (driverFilter === "not_verified") return driver.readiness_status !== "verified";
      if (driverFilter === "needs_review") return driver.readiness_status === "needs_review";
      if (driverFilter === "pi_linked") return Boolean(driver.pi_uid);
      if (driverFilter === "missing_pi") return !driver.pi_uid;
      return true;
    });
  }, [driverFilter, drivers]);

  const filteredRides = useMemo(() => {
    return rides.filter((ride) => {
      if (rideFilter === "completed") return ride.ride_status === "completed";
      if (rideFilter === "active") return ride.report_bucket === "active";
      if (rideFilter === "no_driver_available") return ride.report_bucket === "no_driver_available";
      if (rideFilter === "offers_expired") return ride.report_bucket === "offers_expired";
      if (rideFilter === "cancelled") return ride.report_bucket === "cancelled";
      return true;
    });
  }, [rideFilter, rides]);

  const filteredPayments = useMemo(() => {
    return rides.filter((ride) => {
      if (paymentFilter === "paid") return ride.payment_status === "completed";
      if (paymentFilter === "completed_paid") return ride.report_bucket === "completed_paid";
      if (paymentFilter === "completed_unpaid") return ride.report_bucket === "completed_unpaid";
      if (paymentFilter === "payout_generated") return ride.payout_status !== "not_generated";
      if (paymentFilter === "payout_pending") return ride.payout_status === "pending";
      return true;
    });
  }, [paymentFilter, rides]);

  const exceptionRows = useMemo(() => rides.filter(isRideException), [rides]);

  const stats = useMemo(() => {
    return {
      totalDrivers: drivers.length,
      verifiedDrivers: drivers.filter((driver) => driver.readiness_status === "verified").length,
      unverifiedDrivers: drivers.filter((driver) => driver.readiness_status !== "verified").length,
      piLinkedDrivers: drivers.filter((driver) => Boolean(driver.pi_uid)).length,
      totalRides: rides.length,
      activeRides: rides.filter((ride) => ride.report_bucket === "active").length,
      completedRides: rides.filter((ride) => ride.ride_status === "completed").length,
      paidRides: rides.filter((ride) => ride.payment_status === "completed").length,
      completedUnpaid: rides.filter((ride) => ride.report_bucket === "completed_unpaid").length,
      noDriver: rides.filter((ride) => ride.report_bucket === "no_driver_available").length,
      offersExpired: rides.filter((ride) => ride.report_bucket === "offers_expired").length,
      cancelled: rides.filter((ride) => ride.report_bucket === "cancelled").length,
      exceptions: rides.filter(isRideException).length,
      collectedPi: rides
        .filter((ride) => ride.payment_status === "completed")
        .reduce((sum, ride) => sum + dbNumber(ride.payment_amount_pi), 0),
    };
  }, [drivers, rides]);

  function printReports() {
    window.print();
  }

  return (
    <div style={sectionStyle()} className="truego-admin-reports">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden !important;
            }

            .truego-admin-reports,
            .truego-admin-reports * {
              visibility: visible !important;
            }

            .truego-admin-reports {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: #ffffff !important;
              padding: 24px !important;
              color: #000000 !important;
            }

            .truego-no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Reports / التقارير</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.6 }}>
            Separate operational reports for drivers, rides, payments, and exceptions.
          </p>
        </div>

        <button type="button" onClick={printReports} style={buttonStyle(false)} className="truego-no-print">
          Print current report
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

      <div className="truego-no-print" style={gridStyle()}>
        <div style={itemStyle()}>
          <strong>From date</strong>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 10, border: "1px solid #cbd5e1" }}
          />
        </div>

        <div style={itemStyle()}>
          <strong>To date</strong>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 10, border: "1px solid #cbd5e1" }}
          />
        </div>

        <div style={itemStyle()}>
          <strong>Refresh</strong>
          <div style={{ marginTop: 8 }}>
            <button type="button" onClick={() => void loadReports()} disabled={loading} style={buttonStyle(loading)}>
              {loading ? "Loading..." : "Load reports"}
            </button>
          </div>
        </div>
      </div>

      <div className="truego-no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {[
          ["overview", "Overview"],
          ["drivers", "Driver reports"],
          ["rides", "Ride operations"],
          ["payments", "Payment reports"],
          ["exceptions", "Exceptions"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveReportTab(value as ReportTab)}
            style={activeButtonStyle(activeReportTab === value)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeReportTab === "overview" ? (
        <div style={cardStyle()}>
          <h3 style={{ marginTop: 0 }}>Reports overview</h3>

          <div style={gridStyle()}>
            <div style={itemStyle()}><strong>Total drivers</strong><div>{stats.totalDrivers}</div></div>
            <div style={itemStyle()}><strong>Verified drivers</strong><div>{stats.verifiedDrivers}</div></div>
            <div style={itemStyle()}><strong>Unverified drivers</strong><div>{stats.unverifiedDrivers}</div></div>
            <div style={itemStyle()}><strong>Pi-linked drivers</strong><div>{stats.piLinkedDrivers}</div></div>
            <div style={itemStyle()}><strong>Total rides</strong><div>{stats.totalRides}</div></div>
            <div style={itemStyle()}><strong>Active rides</strong><div>{stats.activeRides}</div></div>
            <div style={itemStyle()}><strong>Completed rides</strong><div>{stats.completedRides}</div></div>
            <div style={itemStyle()}><strong>Paid rides</strong><div>{stats.paidRides}</div></div>
            <div style={itemStyle()}><strong>Completed unpaid</strong><div>{stats.completedUnpaid}</div></div>
            <div style={itemStyle()}><strong>No driver</strong><div>{stats.noDriver}</div></div>
            <div style={itemStyle()}><strong>Offers expired</strong><div>{stats.offersExpired}</div></div>
            <div style={itemStyle()}><strong>Cancelled</strong><div>{stats.cancelled}</div></div>
            <div style={itemStyle()}><strong>Exceptions</strong><div>{stats.exceptions}</div></div>
            <div style={itemStyle()}><strong>Collected Pi</strong><div>{formatPi(stats.collectedPi)}</div></div>
          </div>
        </div>
      ) : null}

      {activeReportTab === "drivers" ? (
        <div style={cardStyle()}>
          <h3 style={{ marginTop: 0 }}>Driver verification report</h3>

          <div className="truego-no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {[
              ["all", "All drivers"],
              ["verified", "Verified"],
              ["not_verified", "Not verified"],
              ["needs_review", "Needs review"],
              ["pi_linked", "Pi linked"],
              ["missing_pi", "Missing Pi"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDriverFilter(value as DriverReportFilter)}
                style={activeButtonStyle(driverFilter === value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle()}>
              <thead>
                <tr>
                  <th style={thStyle()}>Driver</th>
                  <th style={thStyle()}>Pi</th>
                  <th style={thStyle()}>Contact</th>
                  <th style={thStyle()}>Status</th>
                  <th style={thStyle()}>Vehicle</th>
                  <th style={thStyle()}>Documents</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((driver) => (
                  <tr key={driver.demo_driver_id}>
                    <td style={tdStyle()}>
                      <strong>{driver.display_name}</strong>
                      <div style={monoStyle()}>{driver.demo_driver_id}</div>
                    </td>
                    <td style={tdStyle()}>
                      {driver.pi_username ? `@${driver.pi_username}` : "No username"}
                      <div style={monoStyle()}>{driver.pi_uid ?? "No Pi UID"}</div>
                    </td>
                    <td style={tdStyle()}>
                      <div>Email: {driver.email_verified ? "Verified" : "Not verified"}</div>
                      <div>Phone: {driver.phone_verified ? "Verified" : "Not verified"}</div>
                    </td>
                    <td style={tdStyle()}>
                      <span style={badgeStyle(driverBadgeColor(driver))}>
                        {formatDriverStatus(driver)}
                      </span>
                      <div style={{ marginTop: 6 }}>
                        {driver.account_status ?? "pending"} / {driver.onboarding_status ?? "profile_required"}
                      </div>
                    </td>
                    <td style={tdStyle()}>
                      {[driver.vehicle_type, driver.vehicle_make, driver.vehicle_model, driver.vehicle_plate]
                        .filter(Boolean)
                        .join(" · ") || "Not completed"}
                    </td>
                    <td style={tdStyle()}>
                      Total: {driver.documents_count}
                      <div>Approved: {driver.approved_documents_count}</div>
                      <div>Pending: {driver.pending_documents_count}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeReportTab === "rides" ? (
        <div style={cardStyle()}>
          <h3 style={{ marginTop: 0 }}>Ride operations report</h3>

          <div className="truego-no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {[
              ["all", "All rides"],
              ["active", "Active"],
              ["completed", "Completed"],
              ["no_driver_available", "No driver"],
              ["offers_expired", "Offers expired"],
              ["cancelled", "Cancelled"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRideFilter(value as RideReportFilter)}
                style={activeButtonStyle(rideFilter === value)}
              >
                {label}
              </button>
            ))}
          </div>

          <RideReportTable rows={filteredRides} />
        </div>
      ) : null}

      {activeReportTab === "payments" ? (
        <div style={cardStyle()}>
          <h3 style={{ marginTop: 0 }}>Payment report</h3>

          <div className="truego-no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {[
              ["all", "All payments"],
              ["paid", "Paid rides"],
              ["completed_paid", "Completed paid"],
              ["completed_unpaid", "Completed unpaid"],
              ["payout_generated", "Payout generated"],
              ["payout_pending", "Payout pending"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPaymentFilter(value as PaymentReportFilter)}
                style={activeButtonStyle(paymentFilter === value)}
              >
                {label}
              </button>
            ))}
          </div>

          <RideReportTable rows={filteredPayments} showPaymentFocus />
        </div>
      ) : null}

      {activeReportTab === "exceptions" ? (
        <div style={cardStyle()}>
          <h3 style={{ marginTop: 0 }}>Exceptions report</h3>
          <p style={{ marginTop: 0, color: "#64748b" }}>
            Includes completed unpaid rides, cancelled rides, no-driver results, and expired offers.
          </p>

          <RideReportTable rows={exceptionRows} showPaymentFocus />
        </div>
      ) : null}
    </div>
  );
}

function RideReportTable({
  rows,
  showPaymentFocus = false,
}: {
  rows: RideReportRow[];
  showPaymentFocus?: boolean;
}) {
  if (rows.length === 0) {
    return <p style={{ color: "#64748b" }}>No records found for this report.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle()}>
        <thead>
          <tr>
            <th style={thStyle()}>Ride</th>
            <th style={thStyle()}>Route</th>
            <th style={thStyle()}>Rider / Driver</th>
            <th style={thStyle()}>Status</th>
            <th style={thStyle()}>{showPaymentFocus ? "Payment / payout" : "Payment"}</th>
            <th style={thStyle()}>Dates</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ride) => (
            <tr key={ride.ride_id}>
              <td style={tdStyle()}>
                <div style={monoStyle()}>{ride.ride_id}</div>
                <div>{ride.vehicle_type ?? "Vehicle N/A"}</div>
              </td>
              <td style={tdStyle()}>
                <strong>{ride.pickup_text}</strong>
                <div>→ {ride.destination_text}</div>
                <div>{dbNumber(ride.distance_km).toFixed(2)} km · {dbNumber(ride.duration_min)} min</div>
              </td>
              <td style={tdStyle()}>
                <div>Rider: {ride.rider_name ?? "Unknown"}</div>
                <div>Driver: {ride.driver_name ?? "Not assigned"}</div>
              </td>
              <td style={tdStyle()}>
                <span style={badgeStyle(rideBadgeColor(ride))}>{ride.report_bucket}</span>
                <div style={{ marginTop: 6 }}>{ride.ride_status}</div>
              </td>
              <td style={tdStyle()}>
                <div>Status: {ride.payment_status}</div>
                <div>Amount: {formatPi(ride.payment_amount_pi ?? ride.price_pi)}</div>
                {showPaymentFocus ? <div>Payout: {ride.payout_status}</div> : null}
                {showPaymentFocus ? <div>Driver payout: {formatPi(ride.driver_payout_pi)}</div> : null}
                <div style={monoStyle()}>Payment ID: {ride.payment_id ?? "N/A"}</div>
                <div style={monoStyle()}>TXID: {ride.payment_txid ?? "N/A"}</div>
              </td>
              <td style={tdStyle()}>
                <div>Created: {formatDate(ride.created_at)}</div>
                <div>Completed: {formatDate(ride.completed_at)}</div>
                <div>Paid: {formatDate(ride.payment_completed_at)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
