import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import AdminDriverVerificationPanel from "./AdminDriverVerificationPanel";
import ListingReadinessPanel from "../../components/ListingReadinessPanel";
import { listRecentRides, subscribeToLatestRides, type RideRow } from "../../services/rideApi";
import { formatPiAmount } from "../../lib/piPricing";

type AdminTab = "rides" | "drivers";

type RidePaymentSnapshot = {
  payment_status?: "unpaid" | "approved" | "completed" | "cancelled" | "failed" | null;
  payment_provider?: string | null;
  payment_id?: string | null;
  payment_txid?: string | null;
  payment_amount_pi?: number | null;
  payment_completed_at?: string | null;
};

type DashboardStats = {
  total: number;
  active: number;
  completed: number;
  noDriverAvailable: number;
  paid: number;
  collectedPi: number;
};

function formatStatus(status: RideRow["status"]) {
  switch (status) {
    case "searching":
      return "Searching";
    case "offer_sent":
      return "Offer sent";
    case "driver_assigned":
      return "Driver assigned";
    case "driver_arriving":
      return "Driver arriving";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "no_driver_available":
      return "No driver available";
    default:
      return status;
  }
}

function formatPi(value: number) {
  return formatPiAmount(value);
}


function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "N/A";
}


function getPaymentSnapshot(ride: RideRow): RidePaymentSnapshot {
  const extended = ride as RideRow & RidePaymentSnapshot;

  return {
    payment_status: extended.payment_status ?? "unpaid",
    payment_provider: extended.payment_provider ?? null,
    payment_id: extended.payment_id ?? null,
    payment_txid: extended.payment_txid ?? null,
    payment_amount_pi: extended.payment_amount_pi ?? null,
    payment_completed_at: extended.payment_completed_at ?? null,
  };
}

function pageStyle(): React.CSSProperties {
  return {
    maxWidth: 1100,
    margin: "32px auto",
    padding: 20,
  };
}

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

function statsGridStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginTop: 16,
  };
}

function statCardStyle(): React.CSSProperties {
  return {
    padding: 16,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  };
}


function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "10px 14px",
    background: active ? "#111827" : "#ffffff",
    color: active ? "#ffffff" : "#111827",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: active ? "0 8px 20px rgba(15, 23, 42, 0.18)" : "none",
  };
}

function rideCardStyle(): React.CSSProperties {
  return {
    padding: 16,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    marginTop: 12,
  };
}

function badgeStyle(background: string, color = "#ffffff"): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background,
    color,
    fontWeight: 700,
    fontSize: 12,
  };
}


function adminNoticeStyle(): React.CSSProperties {
  return {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    color: "#0369a1",
    lineHeight: 1.6,
    fontSize: 14,
  };
}

function rideDetailGridStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
    marginTop: 12,
  };
}

function rideDetailItemStyle(): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    lineHeight: 1.5,
  };
}

function monoTextStyle(): React.CSSProperties {
  return {
    marginTop: 6,
    wordBreak: "break-all",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    color: "#334155",
  };
}


function rideTimelineGridStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 10,
    marginTop: 12,
  };
}

function timelineItemStyle(): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    lineHeight: 1.5,
  };
}

function paymentBadgeColor(status: RidePaymentSnapshot["payment_status"]) {
  switch (status) {
    case "completed":
      return "#2563eb";
    case "approved":
      return "#7c3aed";
    case "failed":
    case "cancelled":
      return "#dc2626";
    default:
      return "#9ca3af";
  }
}


export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("rides");
  const [rides, setRides] = useState<RideRow[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    active: 0,
    completed: 0,
    noDriverAvailable: 0,
    paid: 0,
    collectedPi: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    try {
      setError(null);

      const [
        recentRides,
        totalResult,
        activeResult,
        completedResult,
        noDriverResult,
        paidResult,
        collectedPiResult,
      ] = await Promise.all([
        listRecentRides(20),
        supabase.from("rides").select("id", { count: "exact", head: true }),
        supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .in("status", [
            "searching",
            "offer_sent",
            "driver_assigned",
            "driver_arriving",
            "in_progress",
          ]),
        supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed"),
        supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .eq("status", "no_driver_available"),
        supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .eq("payment_status", "completed"),
        supabase
          .from("rides")
          .select("payment_amount_pi")
          .eq("payment_status", "completed"),
      ]);

      if (totalResult.error) throw totalResult.error;
      if (activeResult.error) throw activeResult.error;
      if (completedResult.error) throw completedResult.error;
      if (noDriverResult.error) throw noDriverResult.error;
      if (paidResult.error) throw paidResult.error;
      if (collectedPiResult.error) throw collectedPiResult.error;

      const collectedPi = (collectedPiResult.data ?? []).reduce((sum, row) => {
        return sum + Number(row.payment_amount_pi ?? 0);
      }, 0);

      setRides(recentRides);
      setStats({
        total: totalResult.count ?? 0,
        active: activeResult.count ?? 0,
        completed: completedResult.count ?? 0,
        noDriverAvailable: noDriverResult.count ?? 0,
        paid: paidResult.count ?? 0,
        collectedPi,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load admin dashboard";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();

    const unsubscribe = subscribeToLatestRides(() => {
      void loadDashboard();
    });

    return unsubscribe;
  }, []);

  return (
    <div style={pageStyle()}>
      <ListingReadinessPanel context="admin" compact />
      <h1 style={{ marginTop: 0, marginBottom: 0 }}>TrueGo Admin Dashboard</h1>
      <p style={{ color: "#6b7280", marginTop: 8 }}>
        Operations-only view for monitoring rides, driver assignment, and Pi payment status.
      </p>

      <div style={adminNoticeStyle()}>
        <strong>Admin operations checkpoint:</strong> ride/payment monitoring is
        separated from driver verification. Use <strong>Rides & Payments</strong>{" "}
        for trip and Test-Pi payment review, and <strong>Driver Verification</strong>{" "}
        for KYC/document approval.
      </div>

      <div style={statsGridStyle()}>
        <div style={statCardStyle()}>
          <div style={{ color: "#6b7280", fontSize: 14 }}>Total rides</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {stats.total}
          </div>
        </div>

        <div style={statCardStyle()}>
          <div style={{ color: "#6b7280", fontSize: 14 }}>Active rides</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {stats.active}
          </div>
        </div>

        <div style={statCardStyle()}>
          <div style={{ color: "#6b7280", fontSize: 14 }}>Completed rides</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {stats.completed}
          </div>
        </div>

        <div style={statCardStyle()}>
          <div style={{ color: "#6b7280", fontSize: 14 }}>Paid rides</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {stats.paid}
          </div>
        </div>

        <div style={statCardStyle()}>
          <div style={{ color: "#6b7280", fontSize: 14 }}>No driver available</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {stats.noDriverAvailable}
          </div>
        </div>

        <div style={statCardStyle()}>
          <div style={{ color: "#6b7280", fontSize: 14 }}>Collected Pi</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
            {formatPi(stats.collectedPi)}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 16,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("rides")}
          style={tabButtonStyle(activeTab === "rides")}
        >
          Rides & Payments
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("drivers")}
          style={tabButtonStyle(activeTab === "drivers")}
        >
          Driver Verification
        </button>
      </div>

      {activeTab === "drivers" ? <AdminDriverVerificationPanel /> : null}

      {activeTab === "rides" ? (
      <div style={sectionStyle()}>
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
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>Rides & Payments</h2>
            <p style={{ marginTop: 0, color: "#64748b", lineHeight: 1.6 }}>
              Review recent rides, dispatch status, fare, Test-Pi payment state,
              payment ID, and transaction hash.
            </p>
          </div>

          <span style={badgeStyle("#111827")}>
            Collected: {formatPi(stats.collectedPi)}
          </span>
        </div>

        {loading ? <p>Loading rides...</p> : null}

        {error ? (
          <div
            style={{
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

        {!loading && !error && rides.length === 0 ? <p>No rides found yet.</p> : null}

        {!loading && !error && rides.length > 0
          ? rides.map((ride) => {
              const payment = getPaymentSnapshot(ride);
              const isPaid = payment.payment_status === "completed";

              return (
                <div key={ride.id} style={rideCardStyle()}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div><strong>Ride ID:</strong> {ride.id}</div>
                      <div><strong>Status:</strong> {formatStatus(ride.status)}</div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={badgeStyle(ride.status === "completed" ? "#16a34a" : "#6b7280")}>
                        {formatStatus(ride.status)}
                      </span>

                      <span style={badgeStyle(isPaid ? "#2563eb" : "#9ca3af")}>
                        {isPaid ? "Paid" : "Unpaid"}
                      </span>
                    </div>
                  </div>

                  <div style={rideDetailGridStyle()}>
                    <div style={rideDetailItemStyle()}>
                      <strong>Rider</strong>
                      <div style={{ marginTop: 6 }}>{ride.rider_name ?? "Unknown rider"}</div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Driver</strong>
                      <div style={{ marginTop: 6 }}>{ride.driver_name ?? "Not assigned"}</div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Pickup</strong>
                      <div style={{ marginTop: 6 }}>{ride.pickup_text}</div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Destination</strong>
                      <div style={{ marginTop: 6 }}>{ride.destination_text}</div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Distance / Time</strong>
                      <div style={{ marginTop: 6 }}>
                        {ride.distance_km.toFixed(2)} km · {ride.duration_min} min
                      </div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Estimated fare</strong>
                      <div style={{ marginTop: 6 }}>{formatPi(Number(ride.price_pi ?? 0))}</div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Payment status</strong>
                      <div style={{ marginTop: 6 }}>
                        <span style={badgeStyle(paymentBadgeColor(payment.payment_status))}>
                          {payment.payment_status ?? "unpaid"}
                        </span>
                      </div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Payment amount</strong>
                      <div style={{ marginTop: 6 }}>
                        {payment.payment_amount_pi != null
                          ? formatPi(Number(payment.payment_amount_pi))
                          : "Not paid yet"}
                      </div>
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
                    <strong>Ride operation timeline</strong>
                    <div style={rideTimelineGridStyle()}>
                      <div style={timelineItemStyle()}>
                        <strong>Created at</strong>
                        <div style={{ marginTop: 6 }}>{formatDateTime(ride.created_at)}</div>
                      </div>

                      <div style={timelineItemStyle()}>
                        <strong>Accepted at</strong>
                        <div style={{ marginTop: 6 }}>{formatDateTime(ride.accepted_at)}</div>
                      </div>

                      <div style={timelineItemStyle()}>
                        <strong>Started at</strong>
                        <div style={{ marginTop: 6 }}>{formatDateTime(ride.started_at)}</div>
                      </div>

                      <div style={timelineItemStyle()}>
                        <strong>Completed at</strong>
                        <div style={{ marginTop: 6 }}>{formatDateTime(ride.completed_at)}</div>
                      </div>

                      <div style={timelineItemStyle()}>
                        <strong>Payment completed at</strong>
                        <div style={{ marginTop: 6 }}>
                          {formatDateTime(payment.payment_completed_at)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      borderRadius: 12,
                      background: isPaid ? "#ecfdf5" : "#fff7ed",
                      border: isPaid ? "1px solid #bbf7d0" : "1px solid #fed7aa",
                      color: isPaid ? "#047857" : "#9a3412",
                      lineHeight: 1.6,
                    }}
                  >
                    <strong>Payment review:</strong>{" "}
                    {isPaid
                      ? "This ride has a completed Test-Pi payment record."
                      : "Payment is pending or not created yet."}
                    <div style={monoTextStyle()}>
                      Payment ID: {payment.payment_id ?? "N/A"}
                    </div>
                    <div style={monoTextStyle()}>
                      TXID: {payment.payment_txid ?? "N/A"}
                    </div>
                  </div>
                </div>
              );
            })
          : null}
      </div>
      ) : null}
    </div>
  );
}
