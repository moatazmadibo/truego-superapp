import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import AdminDriverVerificationPanel from "./AdminDriverVerificationPanel";
import TrueGoLiveMapCard from "../../components/TrueGoLiveMapCard";
import {
  listRecentRides,
  listRideMessages,
  subscribeToLatestRides,
  type RideCallEventRow,
  type RideMessageRow,
  type RideRow,
} from "../../services/rideApi";
import { formatPiAmount } from "../../lib/piPricing";

type AdminTab = "rides" | "drivers" | "monitor" | "payouts" | "finance";

type RidePaymentSnapshot = {
  payment_status?: "unpaid" | "approved" | "completed" | "cancelled" | "failed" | null;
  payment_provider?: string | null;
  payment_id?: string | null;
  payment_txid?: string | null;
  payment_amount_pi?: number | null;
  payment_completed_at?: string | null;
  payment_attempt_count?: number | null;
  payment_last_error?: string | null;
  payment_last_error_at?: string | null;
};

type DashboardStats = {
  total: number;
  active: number;
  completed: number;
  noDriverAvailable: number;
  paid: number;
  collectedPi: number;
};

type PlatformPayoutSettings = {
  id: string;
  commission_percent: number | string;
  payout_mode: "manual" | "automatic";
  min_payout_pi: number | string;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

type DriverPayoutRow = {
  id: string;
  ride_id: string;
  demo_driver_id: string | null;
  driver_name: string | null;
  driver_pi_uid: string | null;
  driver_pi_username: string | null;
  gross_amount_pi: number | string;
  commission_percent: number | string;
  app_commission_pi: number | string;
  driver_payout_pi: number | string;
  source_payment_status: string | null;
  source_payment_id: string | null;
  source_payment_txid: string | null;
  source_payment_completed_at: string | null;
  payout_status: "pending" | "processing" | "paid" | "failed" | "cancelled";
  payout_payment_id: string | null;
  payout_txid: string | null;
  payout_error: string | null;
  requested_at: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

type PlatformFinanceSettings = {
  id: string;
  accounting_currency: "USD";
  pi_usd_rate: number | string;
  rate_source: string;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

type AccountingAccountRow = {
  code: string;
  name: string;
  account_type: "asset" | "liability" | "revenue" | "expense" | "equity";
  normal_balance: "debit" | "credit";
  is_active: boolean;
  created_at: string;
};

type AccountingJournalEntryRow = {
  id: string;
  entry_date: string;
  source_type: "ride_payment" | "driver_payout" | "expense" | "refund" | "adjustment";
  source_id: string;
  description: string;
  status: "draft" | "posted" | "reversed";
  accounting_currency: "USD";
  pi_usd_rate_snapshot: number | string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type AccountingJournalLineRow = {
  id: string;
  journal_entry_id: string;
  account_code: string;
  line_description: string | null;
  debit_pi: number | string;
  credit_pi: number | string;
  debit_usd: number | string;
  credit_usd: number | string;
  created_at: string;
};

type BusinessExpenseRow = {
  id: string;
  expense_date: string;
  expense_account_code: string;
  category: string | null;
  vendor: string | null;
  description: string;
  amount: number | string;
  currency: "USD" | "PI";
  pi_amount: number | string;
  usd_amount: number | string;
  pi_usd_rate_snapshot: number | string;
  payment_method: string | null;
  status: "draft" | "posted" | "cancelled";
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function formatStatus(status: RideRow["status"]) {
  switch (status) {
    case "searching":
      return "Searching";
    case "collecting_offers":
      return "Collecting driver offers";
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
      return "No driver responded";
    case "offers_expired":
      return "Driver offers expired";
    default:
      return status;
  }
}

function statusBadgeColor(status: RideRow["status"]) {
  switch (status) {
    case "completed":
      return "#16a34a";
    case "driver_assigned":
    case "driver_arriving":
    case "in_progress":
      return "#2563eb";
    case "collecting_offers":
    case "offer_sent":
      return "#7c3aed";
    case "offers_expired":
      return "#f97316";
    case "no_driver_available":
      return "#dc2626";
    case "cancelled":
      return "#991b1b";
    default:
      return "#6b7280";
  }
}

function getStatusAdminHint(status: RideRow["status"]) {
  switch (status) {
    case "no_driver_available":
      return "No driver submitted an offer for the rider's suggested fare.";
    case "offers_expired":
      return "Driver offers arrived, but the rider did not select one before timeout.";
    case "cancelled":
      return "The rider or system cancelled this ride request.";
    case "collecting_offers":
      return "The request is open and drivers can submit same-price or higher offers.";
    case "driver_assigned":
      return "The rider selected a driver offer and the trip is assigned.";
    case "completed":
      return "The ride was completed and is ready for payment review.";
    default:
      return "Monitor dispatch, driver assignment, and Pi payment status.";
  }
}

function formatAdminRiderIdentity(ride: RideRow) {
  return ride.rider_name?.trim() || "Unknown rider";
}

function formatAdminDriverIdentity(ride: RideRow) {
  if (ride.driver_name?.trim()) {
    return `${ride.driver_name} · Driver`;
  }

  if (ride.demo_driver_id) {
    return `${ride.demo_driver_id} · Driver`;
  }

  return "Not assigned";
}

function formatPi(value: number) {
  return formatPiAmount(value);
}


function formatUsd(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;

  return `$${safeValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  })}`;
}


function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "N/A";
}


function formatRouteSource(source?: RideRow["route_source"]) {
  switch (source) {
    case "osrm":
      return "OSRM road route";
    case "fallback":
      return "Fallback estimate";
    default:
      return "Not recorded";
  }
}


function formatVehicleType(vehicleType?: string | null) {
  switch (vehicleType) {
    case "car":
      return "Car";
    case "motorcycle":
      return "Motorcycle";
    default:
      return vehicleType ?? "Not recorded";
  }
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
    payment_attempt_count: extended.payment_attempt_count ?? null,
    payment_last_error: extended.payment_last_error ?? null,
    payment_last_error_at: extended.payment_last_error_at ?? null,
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

function dbNumber(value?: number | string | null) {
  return Number(value ?? 0);
}

function formatPercent(value?: number | string | null) {
  const numberValue = dbNumber(value);

  if (!Number.isFinite(numberValue)) {
    return "0%";
  }

  return `${numberValue.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })}%`;
}

function payoutBadgeColor(status: DriverPayoutRow["payout_status"]) {
  switch (status) {
    case "paid":
      return "#16a34a";
    case "processing":
      return "#7c3aed";
    case "failed":
      return "#dc2626";
    case "cancelled":
      return "#991b1b";
    default:
      return "#f59e0b";
  }
}

function formatPayoutStatus(status: DriverPayoutRow["payout_status"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    case "paid":
      return "Paid";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}


function getPaymentReview(payment: RidePaymentSnapshot) {
  const isCompleted =
    payment.payment_status === "completed" || Boolean(payment.payment_completed_at);

  const hasTxid = Boolean(payment.payment_txid);

  if (isCompleted) {
    return {
      label: "Paid",
      badgeBackground: "#2563eb",
      background: "#ecfdf5",
      border: "1px solid #bbf7d0",
      color: "#047857",
      message: "This ride has a completed Pi payment record.",
    };
  }

  if (payment.payment_status === "approved" && hasTxid) {
    return {
      label: "Needs Pi confirmation",
      badgeBackground: "#f59e0b",
      background: "#fffbeb",
      border: "1px solid #fde68a",
      color: "#92400e",
      message:
        "Payment has a blockchain transaction ID and needs server confirmation retry. Do not ask the rider to pay again.",
    };
  }

  if (payment.payment_status === "approved") {
    return {
      label: "Approved",
      badgeBackground: paymentBadgeColor(payment.payment_status),
      background: "#f5f3ff",
      border: "1px solid #ddd6fe",
      color: "#5b21b6",
      message:
        "Payment has been approved by the TrueGo server and is waiting for Pi blockchain completion.",
    };
  }

  if (payment.payment_status === "failed" || payment.payment_status === "cancelled") {
    return {
      label: payment.payment_status === "cancelled" ? "Cancelled" : "Failed",
      badgeBackground: paymentBadgeColor(payment.payment_status),
      background: "#fef2f2",
      border: "1px solid #fecaca",
      color: "#b91c1c",
      message:
        "Payment attempt did not complete. If there is no transaction ID, the rider can try again.",
    };
  }

  return {
    label: "Unpaid",
    badgeBackground: paymentBadgeColor(payment.payment_status),
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    message: "Payment is pending or not created yet.",
  };
}



function formatMessageSender(message: RideMessageRow) {
  const name = message.sender_name?.trim();

  if (name) {
    return `${name} · ${message.sender_role}`;
  }

  return message.sender_role;
}

function formatCallType(value?: string | null) {
  switch (value) {
    case "phone":
      return "Phone call";
    case "in_app_voice":
      return "In-app voice";
    default:
      return value ?? "Call";
  }
}

function formatCallStatus(value?: string | null) {
  switch (value) {
    case "started":
      return "Started";
    case "missed":
      return "Missed";
    case "ended":
      return "Ended";
    case "failed":
      return "Failed";
    default:
      return value ?? "Unknown";
  }
}

function activityBoxStyle(): React.CSSProperties {
  return {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    lineHeight: 1.6,
  };
}


export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("rides");
  const [selectedMonitorRideId, setSelectedMonitorRideId] = useState("");
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
  const [payoutSettings, setPayoutSettings] = useState<PlatformPayoutSettings | null>(null);
  const [commissionInput, setCommissionInput] = useState("15");
  const [minPayoutInput, setMinPayoutInput] = useState("0");
  const [payoutMode, setPayoutMode] = useState<"manual" | "automatic">("manual");
  const [payoutRows, setPayoutRows] = useState<DriverPayoutRow[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutActionLoading, setPayoutActionLoading] = useState("");
  const [payoutError, setPayoutError] = useState("");
  const [payoutMessage, setPayoutMessage] = useState("");
  const [financeSettings, setFinanceSettings] = useState<PlatformFinanceSettings | null>(null);
  const [piUsdRateInput, setPiUsdRateInput] = useState("0");
  const [financeAccounts, setFinanceAccounts] = useState<AccountingAccountRow[]>([]);
  const [financeEntries, setFinanceEntries] = useState<AccountingJournalEntryRow[]>([]);
  const [financeLines, setFinanceLines] = useState<AccountingJournalLineRow[]>([]);
  const [businessExpenses, setBusinessExpenses] = useState<BusinessExpenseRow[]>([]);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeActionLoading, setFinanceActionLoading] = useState("");
  const [financeError, setFinanceError] = useState("");
  const [financeMessage, setFinanceMessage] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCurrency, setExpenseCurrency] = useState<"USD" | "PI">("USD");
  const [expenseAccountCode, setExpenseAccountCode] = useState("5000");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseVendor, setExpenseVendor] = useState("");
  const [monitorMessages, setMonitorMessages] = useState<RideMessageRow[]>([]);
  const [monitorCallEvents, setMonitorCallEvents] = useState<RideCallEventRow[]>([]);
  const [monitorActivityLoading, setMonitorActivityLoading] = useState(false);
  const [monitorActivityError, setMonitorActivityError] = useState("");

  async function loadPayoutDashboard() {
    setPayoutLoading(true);
    setPayoutError("");

    try {
      const [settingsResult, payoutsResult] = await Promise.all([
        supabase.rpc("get_platform_payout_settings"),
        supabase
          .from("driver_payouts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (settingsResult.error) throw settingsResult.error;
      if (payoutsResult.error) throw payoutsResult.error;

      const nextSettings = settingsResult.data as PlatformPayoutSettings | null;
      setPayoutSettings(nextSettings);

      if (nextSettings) {
        setCommissionInput(String(dbNumber(nextSettings.commission_percent)));
        setMinPayoutInput(String(dbNumber(nextSettings.min_payout_pi)));
        setPayoutMode(nextSettings.payout_mode);
      }

      setPayoutRows((payoutsResult.data ?? []) as unknown as DriverPayoutRow[]);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load payout dashboard.";
      setPayoutError(message);
    } finally {
      setPayoutLoading(false);
    }
  }

  async function savePayoutSettings() {
    setPayoutActionLoading("settings");
    setPayoutError("");
    setPayoutMessage("");

    try {
      const commission = Number(commissionInput);
      const minPayout = Number(minPayoutInput || 0);

      if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
        throw new Error("Commission percent must be between 0 and 100.");
      }

      if (!Number.isFinite(minPayout) || minPayout < 0) {
        throw new Error("Minimum payout must be zero or greater.");
      }

      const { data, error: saveError } = await supabase.rpc(
        "update_platform_payout_settings",
        {
          p_commission_percent: commission,
          p_payout_mode: payoutMode,
          p_min_payout_pi: minPayout,
          p_updated_by: "admin-dashboard",
        }
      );

      if (saveError) throw saveError;

      const savedSettings = data as PlatformPayoutSettings;
      setPayoutSettings(savedSettings);
      setCommissionInput(String(dbNumber(savedSettings.commission_percent)));
      setMinPayoutInput(String(dbNumber(savedSettings.min_payout_pi)));
      setPayoutMode(savedSettings.payout_mode);
      setPayoutMessage("Payout settings saved successfully.");
      await loadPayoutDashboard();
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Failed to save payout settings.";
      setPayoutError(message);
    } finally {
      setPayoutActionLoading("");
    }
  }

  async function generatePendingPayoutRecords() {
    setPayoutActionLoading("generate");
    setPayoutError("");
    setPayoutMessage("");

    try {
      const { data: paidRides, error: ridesError } = await supabase
        .from("rides")
        .select("*")
        .eq("status", "completed")
        .eq("payment_status", "completed")
        .not("demo_driver_id", "is", null)
        .order("completed_at", { ascending: false })
        .limit(50);

      if (ridesError) throw ridesError;

      let successCount = 0;
      const failures: string[] = [];

      for (const ride of (paidRides ?? []) as RideRow[]) {
        const { error: payoutError } = await supabase.rpc(
          "upsert_driver_payout_for_completed_ride",
          {
            p_ride_id: ride.id,
            p_commission_percent: null,
          }
        );

        if (payoutError) {
          failures.push(`${ride.id}: ${payoutError.message}`);
        } else {
          successCount += 1;
        }
      }

      setPayoutMessage(
        failures.length > 0
          ? `Payout records refreshed: ${successCount} succeeded, ${failures.length} skipped/failed.`
          : `Payout records refreshed: ${successCount} succeeded.`
      );

      if (failures.length > 0) {
        setPayoutError(failures.slice(0, 3).join("\n"));
      }

      await loadPayoutDashboard();
    } catch (generateError) {
      const message =
        generateError instanceof Error
          ? generateError.message
          : "Failed to generate payout records.";
      setPayoutError(message);
    } finally {
      setPayoutActionLoading("");
    }
  }

  async function loadFinanceDashboard() {
    setFinanceLoading(true);
    setFinanceError("");

    try {
      const [
        settingsResult,
        accountsResult,
        entriesResult,
        linesResult,
        expensesResult,
      ] = await Promise.all([
        supabase.rpc("get_platform_finance_settings"),
        supabase.rpc("get_accounting_accounts"),
        supabase
          .from("accounting_journal_entries")
          .select("*")
          .order("entry_date", { ascending: false })
          .limit(30),
        supabase
          .from("accounting_journal_lines")
          .select("*")
          .limit(1000),
        supabase.rpc("get_business_expenses"),
      ]);

      if (settingsResult.error) throw settingsResult.error;
      if (accountsResult.error) throw accountsResult.error;
      if (entriesResult.error) throw entriesResult.error;
      if (linesResult.error) throw linesResult.error;
      if (expensesResult.error) throw expensesResult.error;

      const nextSettings = settingsResult.data as PlatformFinanceSettings;
      setFinanceSettings(nextSettings);
      setPiUsdRateInput(String(dbNumber(nextSettings.pi_usd_rate)));

      setFinanceAccounts((accountsResult.data ?? []) as unknown as AccountingAccountRow[]);
      setFinanceEntries((entriesResult.data ?? []) as unknown as AccountingJournalEntryRow[]);
      setFinanceLines((linesResult.data ?? []) as unknown as AccountingJournalLineRow[]);
      setBusinessExpenses((expensesResult.data ?? []) as unknown as BusinessExpenseRow[]);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load finance dashboard.";
      setFinanceError(message);
    } finally {
      setFinanceLoading(false);
    }
  }

  async function saveFinanceSettings() {
    setFinanceActionLoading("settings");
    setFinanceError("");
    setFinanceMessage("");

    try {
      const rate = Number(piUsdRateInput);

      if (!Number.isFinite(rate) || rate < 0) {
        throw new Error("Pi to USD rate must be zero or greater.");
      }

      const { data, error: saveError } = await supabase.rpc(
        "update_platform_finance_settings",
        {
          p_pi_usd_rate: rate,
          p_updated_by: "admin-dashboard",
        }
      );

      if (saveError) throw saveError;

      const savedSettings = data as PlatformFinanceSettings;
      setFinanceSettings(savedSettings);
      setPiUsdRateInput(String(dbNumber(savedSettings.pi_usd_rate)));
      setFinanceMessage("Finance settings saved successfully.");
      await loadFinanceDashboard();
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Failed to save finance settings.";
      setFinanceError(message);
    } finally {
      setFinanceActionLoading("");
    }
  }

  async function postAccountingForCompletedPaidRides() {
    setFinanceActionLoading("post-rides");
    setFinanceError("");
    setFinanceMessage("");

    try {
      const { data: paidRides, error: ridesError } = await supabase
        .from("rides")
        .select("*")
        .eq("status", "completed")
        .eq("payment_status", "completed")
        .not("demo_driver_id", "is", null)
        .order("payment_completed_at", { ascending: false })
        .limit(50);

      if (ridesError) throw ridesError;

      let successCount = 0;
      const failures: string[] = [];

      for (const ride of (paidRides ?? []) as unknown as RideRow[]) {
        const { error: postError } = await supabase.rpc(
          "post_ride_payment_accounting",
          {
            p_ride_id: ride.id,
          }
        );

        if (postError) {
          failures.push(`${ride.id}: ${postError.message}`);
        } else {
          successCount += 1;
        }
      }

      setFinanceMessage(
        failures.length > 0
          ? `Accounting posting finished: ${successCount} posted, ${failures.length} skipped/failed.`
          : `Accounting posting finished: ${successCount} posted.`
      );

      if (failures.length > 0) {
        setFinanceError(failures.slice(0, 4).join("\n"));
      }

      await loadFinanceDashboard();
    } catch (postError) {
      const message =
        postError instanceof Error
          ? postError.message
          : "Failed to post accounting entries.";
      setFinanceError(message);
    } finally {
      setFinanceActionLoading("");
    }
  }

  async function createExpenseRecord() {
    setFinanceActionLoading("expense");
    setFinanceError("");
    setFinanceMessage("");

    try {
      const amount = Number(expenseAmount);

      if (!expenseDescription.trim()) {
        throw new Error("Expense description is required.");
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Expense amount must be greater than zero.");
      }

      const { error: expenseError } = await supabase.rpc(
        "create_business_expense",
        {
          p_description: expenseDescription.trim(),
          p_amount: amount,
          p_currency: expenseCurrency,
          p_expense_account_code: expenseAccountCode,
          p_category: expenseCategory.trim() || null,
          p_vendor: expenseVendor.trim() || null,
          p_payment_method: null,
          p_receipt_file_path: null,
          p_created_by: "admin-dashboard",
        }
      );

      if (expenseError) throw expenseError;

      setExpenseDescription("");
      setExpenseAmount("");
      setExpenseCategory("");
      setExpenseVendor("");
      setFinanceMessage("Expense record created as draft.");
      await loadFinanceDashboard();
    } catch (expenseError) {
      const message =
        expenseError instanceof Error ? expenseError.message : "Failed to create expense.";
      setFinanceError(message);
    } finally {
      setFinanceActionLoading("");
    }
  }

  async function postExpenseAccounting(expenseId: string) {
    setFinanceActionLoading(`post-expense:${expenseId}`);
    setFinanceError("");
    setFinanceMessage("");

    try {
      const { error: postError } = await supabase.rpc(
        "post_business_expense_accounting",
        {
          p_expense_id: expenseId,
        }
      );

      if (postError) throw postError;

      setFinanceMessage("Expense accounting entry posted successfully.");
      await loadFinanceDashboard();
    } catch (postError) {
      const message =
        postError instanceof Error
          ? postError.message
          : "Failed to post expense accounting entry.";
      setFinanceError(message);
    } finally {
      setFinanceActionLoading("");
    }
  }

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


  async function loadMonitorActivity(rideId: string) {
    setMonitorActivityLoading(true);
    setMonitorActivityError("");

    try {
      const [messages, callEventsResult] = await Promise.all([
        listRideMessages(rideId),
        supabase
          .from("ride_call_events")
          .select("*")
          .eq("ride_id", rideId)
          .order("created_at", { ascending: true }),
      ]);

      if (callEventsResult.error) {
        throw callEventsResult.error;
      }

      setMonitorMessages(messages);
      setMonitorCallEvents((callEventsResult.data ?? []) as RideCallEventRow[]);
    } catch (activityError) {
      const message =
        activityError instanceof Error
          ? activityError.message
          : "Failed to load ride communication activity.";
      setMonitorActivityError(message);
    } finally {
      setMonitorActivityLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();

    const unsubscribe = subscribeToLatestRides(() => {
      void loadDashboard();
    });

    return unsubscribe;
  }, []);


  useEffect(() => {
    if (activeTab === "payouts") {
      void loadPayoutDashboard();
    }
  }, [activeTab]);


  useEffect(() => {
    if (activeTab === "finance") {
      void loadFinanceDashboard();
    }
  }, [activeTab]);


  const activeMonitorRides = rides.filter((ride) =>
    [
      "collecting_offers",
      "driver_assigned",
      "driver_arriving",
      "in_progress",
      "completed",
    ].includes(ride.status)
  );

  const monitorRide =
    rides.find((ride) => ride.id === selectedMonitorRideId) ??
    activeMonitorRides[0] ??
    rides[0] ??
    null;

  useEffect(() => {
    if (!monitorRide?.id) {
      setMonitorMessages([]);
      setMonitorCallEvents([]);
      return;
    }

    void loadMonitorActivity(monitorRide.id);
  }, [monitorRide?.id]);

  const financeSummary = {
    piWalletPi: financeLines
      .filter((line) => line.account_code === "1000")
      .reduce((sum, line) => sum + dbNumber(line.debit_pi) - dbNumber(line.credit_pi), 0),
    piWalletUsd: financeLines
      .filter((line) => line.account_code === "1000")
      .reduce((sum, line) => sum + dbNumber(line.debit_usd) - dbNumber(line.credit_usd), 0),
    commissionRevenuePi: financeLines
      .filter((line) => line.account_code === "4000")
      .reduce((sum, line) => sum + dbNumber(line.credit_pi) - dbNumber(line.debit_pi), 0),
    commissionRevenueUsd: financeLines
      .filter((line) => line.account_code === "4000")
      .reduce((sum, line) => sum + dbNumber(line.credit_usd) - dbNumber(line.debit_usd), 0),
    driverPayablesPi: financeLines
      .filter((line) => line.account_code === "2000")
      .reduce((sum, line) => sum + dbNumber(line.credit_pi) - dbNumber(line.debit_pi), 0),
    driverPayablesUsd: financeLines
      .filter((line) => line.account_code === "2000")
      .reduce((sum, line) => sum + dbNumber(line.credit_usd) - dbNumber(line.debit_usd), 0),
    expensesPi: financeLines
      .filter((line) => line.account_code.startsWith("5"))
      .reduce((sum, line) => sum + dbNumber(line.debit_pi) - dbNumber(line.credit_pi), 0),
    expensesUsd: financeLines
      .filter((line) => line.account_code.startsWith("5"))
      .reduce((sum, line) => sum + dbNumber(line.debit_usd) - dbNumber(line.credit_usd), 0),
  };

  return (
    <div style={pageStyle()}>      <h1 style={{ marginTop: 0, marginBottom: 0 }}>TrueGo Admin Dashboard</h1>
      <p style={{ color: "#6b7280", marginTop: 8 }}>
        Operations-only view for monitoring rides, driver assignment, and Pi payment status.
      </p>

      <div style={adminNoticeStyle()}>
        <strong>Operations overview:</strong> ride and payment monitoring is
        separated from driver verification. Use <strong>Rides & Payments</strong>{" "}
        for trip and Pi payment review, and <strong>Driver Verification</strong>{" "}
        for document approval.
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

        <button
          type="button"
          onClick={() => setActiveTab("monitor")}
          style={tabButtonStyle(activeTab === "monitor")}
        >
          Live Ride Monitor
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payouts")}
          style={tabButtonStyle(activeTab === "payouts")}
        >
          Payouts / Commission
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("finance")}
          style={tabButtonStyle(activeTab === "finance")}
        >
          Finance / Accounting
        </button>
      </div>

      {activeTab === "drivers" ? <AdminDriverVerificationPanel /> : null}

      {activeTab === "monitor" ? (
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
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>Live Ride Monitor</h2>
              <p style={{ marginTop: 0, color: "#64748b", lineHeight: 1.6 }}>
                Select an active or recent ride and monitor pickup, destination,
                selected driver, route, status, and payment state on the unified TrueGo map.
              </p>
            </div>

            <span style={badgeStyle("#111827")}>
              {activeMonitorRides.length} active / trackable
            </span>
          </div>

          {rides.length > 0 ? (
            <>
              <label
                htmlFor="admin-live-ride-select"
                style={{ display: "block", marginTop: 12, fontWeight: 800 }}
              >
                Select ride to monitor
              </label>

              <select
                id="admin-live-ride-select"
                value={monitorRide?.id ?? ""}
                onChange={(event) => setSelectedMonitorRideId(event.target.value)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  font: "inherit",
                }}
              >
                {rides.map((ride) => (
                  <option key={ride.id} value={ride.id}>
                    {formatStatus(ride.status)} · {ride.pickup_text} → {ride.destination_text} · {ride.driver_name ?? "No driver"} · {ride.id}
                  </option>
                ))}
              </select>

              {monitorRide ? (
                <>
                  <div style={rideDetailGridStyle()}>
                    <div style={rideDetailItemStyle()}>
                      <strong>Ride status</strong>
                      <div style={{ marginTop: 6 }}>{formatStatus(monitorRide.status)}</div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Driver</strong>
                      <div style={{ marginTop: 6 }}>{monitorRide.driver_name ?? "Not assigned"}</div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Fare</strong>
                      <div style={{ marginTop: 6 }}>
                        {formatPi(Number(monitorRide.price_pi ?? 0))}
                      </div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Payment</strong>
                      <div style={{ marginTop: 6 }}>
                        {getPaymentReview(getPaymentSnapshot(monitorRide)).label}
                      </div>
                    </div>
                  </div>

                  <TrueGoLiveMapCard
                    ride={monitorRide}
                    viewer="admin"
                    selectedDriverId={monitorRide.demo_driver_id}
                  />

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <h3 style={{ margin: 0 }}>Ride communication activity</h3>

                    <button
                      type="button"
                      onClick={() => {
                        void loadMonitorActivity(monitorRide.id);
                      }}
                      disabled={monitorActivityLoading}
                      style={tabButtonStyle(false)}
                    >
                      {monitorActivityLoading ? "Refreshing..." : "Refresh activity"}
                    </button>
                  </div>

                  {monitorActivityError ? (
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
                      {monitorActivityError}
                    </div>
                  ) : null}

                  <div style={rideDetailGridStyle()}>
                    <div style={rideDetailItemStyle()}>
                      <strong>Rider identity</strong>
                      <div style={{ marginTop: 6 }}>{formatAdminRiderIdentity(monitorRide)}</div>
                      <div style={monoTextStyle()}>
                        Pi UID: {monitorRide.rider_pi_uid ?? "N/A"}
                      </div>
                      <div style={monoTextStyle()}>
                        Username: {monitorRide.rider_pi_username ? `@${monitorRide.rider_pi_username}` : "N/A"}
                      </div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Driver identity</strong>
                      <div style={{ marginTop: 6 }}>{formatAdminDriverIdentity(monitorRide)}</div>
                      <div style={monoTextStyle()}>
                        Driver profile ID: {monitorRide.demo_driver_id ?? "N/A"}
                      </div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Route operation</strong>
                      <div style={{ marginTop: 6 }}>
                        {monitorRide.pickup_text} → {monitorRide.destination_text}
                      </div>
                      <div style={{ marginTop: 6 }}>
                        {monitorRide.distance_km.toFixed(2)} km · {monitorRide.duration_min} min
                      </div>
                      <div style={{ marginTop: 6 }}>
                        Source: {formatRouteSource(monitorRide.route_source)}
                      </div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Payment snapshot</strong>
                      <div style={{ marginTop: 6 }}>
                        <span style={badgeStyle(getPaymentReview(getPaymentSnapshot(monitorRide)).badgeBackground)}>
                          {getPaymentReview(getPaymentSnapshot(monitorRide)).label}
                        </span>
                      </div>
                      <div style={monoTextStyle()}>
                        Payment ID: {getPaymentSnapshot(monitorRide).payment_id ?? "N/A"}
                      </div>
                      <div style={monoTextStyle()}>
                        TXID: {getPaymentSnapshot(monitorRide).payment_txid ?? "N/A"}
                      </div>
                    </div>
                  </div>

                  <div style={activityBoxStyle()}>
                    <strong>In-app messages</strong>

                    {monitorMessages.length === 0 ? (
                      <p style={{ marginBottom: 0, color: "#64748b" }}>
                        No in-app messages recorded for this ride yet.
                      </p>
                    ) : (
                      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                        {monitorMessages.map((message) => (
                          <div
                            key={message.id}
                            style={{
                              padding: 10,
                              borderRadius: 10,
                              background: "#f8fafc",
                              border: "1px solid #e5e7eb",
                            }}
                          >
                            <div>
                              <strong>{formatMessageSender(message)}</strong>
                              <span style={{ color: "#64748b", fontSize: 12 }}>
                                {" "}· {formatDateTime(message.created_at)}
                              </span>
                            </div>
                            <div style={{ marginTop: 4 }}>{message.message_text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={activityBoxStyle()}>
                    <strong>Call events</strong>

                    {monitorCallEvents.length === 0 ? (
                      <p style={{ marginBottom: 0, color: "#64748b" }}>
                        No phone or voice call events recorded for this ride yet.
                      </p>
                    ) : (
                      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                        {monitorCallEvents.map((event) => (
                          <div
                            key={event.id}
                            style={{
                              padding: 10,
                              borderRadius: 10,
                              background: "#f8fafc",
                              border: "1px solid #e5e7eb",
                            }}
                          >
                            <div>
                              <strong>{formatCallType(event.call_type)}</strong>{" "}
                              · {formatCallStatus(event.call_status)}
                            </div>
                            <div style={{ color: "#64748b", fontSize: 13 }}>
                              {event.caller_role} → {event.callee_role}
                            </div>
                            <div style={{ color: "#64748b", fontSize: 13 }}>
                              Started: {formatDateTime(event.started_at)}
                            </div>
                            {event.ended_at ? (
                              <div style={{ color: "#64748b", fontSize: 13 }}>
                                Ended: {formatDateTime(event.ended_at)}
                              </div>
                            ) : null}
                            {event.callee_phone ? (
                              <div style={monoTextStyle()}>
                                Callee phone: {event.callee_phone}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <p style={{ color: "#64748b" }}>No rides available to monitor yet.</p>
          )}
        </div>
      ) : null}

      {activeTab === "finance" ? (
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
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>Finance / Accounting</h2>
              <p style={{ marginTop: 0, color: "#64748b", lineHeight: 1.6 }}>
                Internal accounting ledger using Pi as operational currency and USD as secondary reporting currency.
              </p>
            </div>

            <span style={badgeStyle("#111827")}>
              Currency: {financeSettings?.accounting_currency ?? "USD"}
            </span>
          </div>

          {financeError ? (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                whiteSpace: "pre-wrap",
              }}
            >
              {financeError}
            </div>
          ) : null}

          {financeMessage ? (
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
              {financeMessage}
            </div>
          ) : null}

          <div style={rideDetailGridStyle()}>
            <div style={rideDetailItemStyle()}>
              <strong>Internal Pi valuation: USD per 1 Pi</strong>
              <input
                value={piUsdRateInput}
                onChange={(event) => setPiUsdRateInput(event.target.value)}
                placeholder="Example: 314159"
                inputMode="decimal"
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: 11,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  font: "inherit",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                Internal reporting basis. For GCV accounting, use 314159.
              </div>
            </div>

            <div style={rideDetailItemStyle()}>
              <strong>Current finance settings</strong>
              <div style={{ marginTop: 8 }}>
                USD per 1 Pi: {dbNumber(financeSettings?.pi_usd_rate).toLocaleString(undefined, {
                  maximumFractionDigits: 8,
                })}
              </div>
              <div>Source: {financeSettings?.rate_source ?? "manual"}</div>
              <div>Updated: {formatDateTime(financeSettings?.updated_at)}</div>
            </div>

            <div style={rideDetailItemStyle()}>
              <strong>Pi App Wallet balance</strong>
              <div style={{ marginTop: 8 }}>{formatPi(financeSummary.piWalletPi)}</div>
              <div>{formatUsd(financeSummary.piWalletUsd)}</div>
            </div>

            <div style={rideDetailItemStyle()}>
              <strong>Commission revenue</strong>
              <div style={{ marginTop: 8 }}>{formatPi(financeSummary.commissionRevenuePi)}</div>
              <div>{formatUsd(financeSummary.commissionRevenueUsd)}</div>
            </div>

            <div style={rideDetailItemStyle()}>
              <strong>Driver payables</strong>
              <div style={{ marginTop: 8 }}>{formatPi(financeSummary.driverPayablesPi)}</div>
              <div>{formatUsd(financeSummary.driverPayablesUsd)}</div>
            </div>

            <div style={rideDetailItemStyle()}>
              <strong>Expenses</strong>
              <div style={{ marginTop: 8 }}>{formatPi(financeSummary.expensesPi)}</div>
              <div>{formatUsd(financeSummary.expensesUsd)}</div>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                void saveFinanceSettings();
              }}
              disabled={financeActionLoading !== ""}
              style={tabButtonStyle(false)}
            >
              {financeActionLoading === "settings" ? "Saving..." : "Save finance settings"}
            </button>

            <button
              type="button"
              onClick={() => {
                void postAccountingForCompletedPaidRides();
              }}
              disabled={financeActionLoading !== ""}
              style={tabButtonStyle(false)}
            >
              {financeActionLoading === "post-rides"
                ? "Posting..."
                : "Post ride payment accounting"}
            </button>

            <button
              type="button"
              onClick={() => {
                void loadFinanceDashboard();
              }}
              disabled={financeLoading}
              style={tabButtonStyle(false)}
            >
              {financeLoading ? "Refreshing..." : "Refresh finance"}
            </button>
          </div>

          <div style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 8 }}>Create business expense</h3>

            <div style={rideDetailGridStyle()}>
              <div style={rideDetailItemStyle()}>
                <strong>Description</strong>
                <input
                  value={expenseDescription}
                  onChange={(event) => setExpenseDescription(event.target.value)}
                  placeholder="Example: Vercel hosting"
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: 11,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    font: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={rideDetailItemStyle()}>
                <strong>Amount</strong>
                <input
                  value={expenseAmount}
                  onChange={(event) => setExpenseAmount(event.target.value)}
                  placeholder="Example: 20"
                  inputMode="decimal"
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: 11,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    font: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={rideDetailItemStyle()}>
                <strong>Currency</strong>
                <select
                  value={expenseCurrency}
                  onChange={(event) => setExpenseCurrency(event.target.value as "USD" | "PI")}
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: 11,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    font: "inherit",
                  }}
                >
                  <option value="USD">USD</option>
                  <option value="PI">PI</option>
                </select>
              </div>

              <div style={rideDetailItemStyle()}>
                <strong>Expense account</strong>
                <select
                  value={expenseAccountCode}
                  onChange={(event) => setExpenseAccountCode(event.target.value)}
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: 11,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    font: "inherit",
                  }}
                >
                  {financeAccounts
                    .filter((account) => account.account_type === "expense")
                    .map((account) => (
                      <option key={account.code} value={account.code}>
                        {account.code} · {account.name}
                      </option>
                    ))}
                </select>
              </div>

              <div style={rideDetailItemStyle()}>
                <strong>Category</strong>
                <input
                  value={expenseCategory}
                  onChange={(event) => setExpenseCategory(event.target.value)}
                  placeholder="Example: hosting"
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: 11,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    font: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={rideDetailItemStyle()}>
                <strong>Vendor</strong>
                <input
                  value={expenseVendor}
                  onChange={(event) => setExpenseVendor(event.target.value)}
                  placeholder="Example: Vercel"
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: 11,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    font: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => {
                  void createExpenseRecord();
                }}
                disabled={financeActionLoading !== ""}
                style={tabButtonStyle(false)}
              >
                {financeActionLoading === "expense" ? "Saving expense..." : "Create draft expense"}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 8 }}>Chart of accounts</h3>

            <div style={rideDetailGridStyle()}>
              {financeAccounts.map((account) => (
                <div key={account.code} style={rideDetailItemStyle()}>
                  <strong>{account.code} · {account.name}</strong>
                  <div style={{ marginTop: 6 }}>
                    Type: {account.account_type} · Normal: {account.normal_balance}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 8 }}>Latest journal entries</h3>

            {financeEntries.length === 0 ? (
              <p style={{ color: "#64748b" }}>No accounting journal entries yet.</p>
            ) : null}

            {financeEntries.map((entry) => (
              <div key={entry.id} style={rideCardStyle()}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong>{entry.description}</strong>
                    <div style={monoTextStyle()}>Source: {entry.source_type} · {entry.source_id}</div>
                  </div>
                  <span style={badgeStyle(entry.status === "posted" ? "#16a34a" : "#64748b")}>
                    {entry.status}
                  </span>
                </div>
                <div style={{ marginTop: 8 }}>
                  Entry date: {formatDateTime(entry.entry_date)} · Rate: {dbNumber(entry.pi_usd_rate_snapshot)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 8 }}>Business expenses</h3>

            {businessExpenses.length === 0 ? (
              <p style={{ color: "#64748b" }}>No business expenses recorded yet.</p>
            ) : null}

            {businessExpenses.map((expense) => (
              <div key={expense.id} style={rideCardStyle()}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong>{expense.description}</strong>
                    <div style={{ marginTop: 6 }}>
                      {expense.vendor ?? "No vendor"} · {expense.category ?? "No category"}
                    </div>
                  </div>
                  <span style={badgeStyle(expense.status === "draft" ? "#f59e0b" : "#16a34a")}>
                    {expense.status}
                  </span>
                </div>

                {expense.status === "draft" ? (
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => {
                        void postExpenseAccounting(expense.id);
                      }}
                      disabled={financeActionLoading !== ""}
                      style={tabButtonStyle(false)}
                    >
                      {financeActionLoading === `post-expense:${expense.id}`
                        ? "Posting expense..."
                        : "Post expense accounting"}
                    </button>
                  </div>
                ) : null}

                <div style={rideDetailGridStyle()}>
                  <div style={rideDetailItemStyle()}>
                    <strong>Original amount</strong>
                    <div>{dbNumber(expense.amount)} {expense.currency}</div>
                  </div>

                  <div style={rideDetailItemStyle()}>
                    <strong>Accounting snapshot</strong>
                    <div>{formatPi(dbNumber(expense.pi_amount))}</div>
                    <div>{formatUsd(dbNumber(expense.usd_amount))}</div>
                  </div>

                  <div style={rideDetailItemStyle()}>
                    <strong>Account</strong>
                    <div>{expense.expense_account_code}</div>
                    <div>Date: {expense.expense_date}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}


      {activeTab === "payouts" ? (
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
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>Payouts / Commission</h2>
              <p style={{ marginTop: 0, color: "#64748b", lineHeight: 1.6 }}>
                Configure TrueGo commission manually and create pending driver payout records from completed paid rides.
                This stage does not send Pi to drivers yet.
              </p>
            </div>

            <span style={badgeStyle("#111827")}>
              Mode: {payoutSettings?.payout_mode ?? "manual"}
            </span>
          </div>

          {payoutError ? (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                whiteSpace: "pre-wrap",
              }}
            >
              {payoutError}
            </div>
          ) : null}

          {payoutMessage ? (
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
              {payoutMessage}
            </div>
          ) : null}

          <div style={rideDetailGridStyle()}>
            <div style={rideDetailItemStyle()}>
              <strong>Application commission %</strong>
              <input
                value={commissionInput}
                onChange={(event) => setCommissionInput(event.target.value)}
                placeholder="Example: 7.5"
                inputMode="decimal"
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: 11,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  font: "inherit",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                Accepts any value from 0 to 100, for example 7, 8, 7.5, or 12.75.
              </div>
            </div>

            <div style={rideDetailItemStyle()}>
              <strong>Payout mode</strong>
              <select
                value={payoutMode}
                onChange={(event) =>
                  setPayoutMode(event.target.value as "manual" | "automatic")
                }
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: 11,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  font: "inherit",
                }}
              >
                <option value="manual">Manual review</option>
                <option value="automatic">Automatic later</option>
              </select>
              <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                Automatic mode is reserved for a later A2U payout function.
              </div>
            </div>

            <div style={rideDetailItemStyle()}>
              <strong>Minimum payout Pi</strong>
              <input
                value={minPayoutInput}
                onChange={(event) => setMinPayoutInput(event.target.value)}
                placeholder="0"
                inputMode="decimal"
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: 11,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  font: "inherit",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                Keep 0 during Test-Pi validation.
              </div>
            </div>

            <div style={rideDetailItemStyle()}>
              <strong>Current settings</strong>
              <div style={{ marginTop: 8 }}>
                Commission: {formatPercent(payoutSettings?.commission_percent)}
              </div>
              <div>Minimum payout: {formatPi(dbNumber(payoutSettings?.min_payout_pi))}</div>
              <div>Updated: {formatDateTime(payoutSettings?.updated_at)}</div>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                void savePayoutSettings();
              }}
              disabled={payoutActionLoading !== ""}
              style={tabButtonStyle(false)}
            >
              {payoutActionLoading === "settings" ? "Saving..." : "Save payout settings"}
            </button>

            <button
              type="button"
              onClick={() => {
                void generatePendingPayoutRecords();
              }}
              disabled={payoutActionLoading !== ""}
              style={tabButtonStyle(false)}
            >
              {payoutActionLoading === "generate"
                ? "Generating..."
                : "Generate payout records from paid rides"}
            </button>

            <button
              type="button"
              onClick={() => {
                void loadPayoutDashboard();
              }}
              disabled={payoutLoading}
              style={tabButtonStyle(false)}
            >
              {payoutLoading ? "Refreshing..." : "Refresh payouts"}
            </button>
          </div>

          <div style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 8 }}>Driver payout records</h3>

            {payoutLoading ? <p>Loading payouts...</p> : null}

            {!payoutLoading && payoutRows.length === 0 ? (
              <p style={{ color: "#64748b" }}>
                No payout records yet. Generate records after completed paid rides.
              </p>
            ) : null}

            {payoutRows.map((payout) => (
              <div key={payout.id} style={rideCardStyle()}>
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
                    <div><strong>Driver:</strong> {payout.driver_name ?? "Unknown driver"}</div>
                    <div style={monoTextStyle()}>Ride ID: {payout.ride_id}</div>
                    <div style={monoTextStyle()}>
                      Pi: {payout.driver_pi_username ? `@${payout.driver_pi_username}` : "N/A"} · UID: {payout.driver_pi_uid ?? "N/A"}
                    </div>
                  </div>

                  <span style={badgeStyle(payoutBadgeColor(payout.payout_status))}>
                    {formatPayoutStatus(payout.payout_status)}
                  </span>
                </div>

                <div style={rideDetailGridStyle()}>
                  <div style={rideDetailItemStyle()}>
                    <strong>Gross paid by rider</strong>
                    <div style={{ marginTop: 6 }}>{formatPi(dbNumber(payout.gross_amount_pi))}</div>
                  </div>

                  <div style={rideDetailItemStyle()}>
                    <strong>TrueGo commission</strong>
                    <div style={{ marginTop: 6 }}>{formatPercent(payout.commission_percent)}</div>
                    <div>{formatPi(dbNumber(payout.app_commission_pi))}</div>
                  </div>

                  <div style={rideDetailItemStyle()}>
                    <strong>Driver payout</strong>
                    <div style={{ marginTop: 6 }}>{formatPi(dbNumber(payout.driver_payout_pi))}</div>
                  </div>

                  <div style={rideDetailItemStyle()}>
                    <strong>Source payment</strong>
                    <div>Status: {payout.source_payment_status ?? "N/A"}</div>
                    <div style={monoTextStyle()}>Payment ID: {payout.source_payment_id ?? "N/A"}</div>
                    <div style={monoTextStyle()}>TXID: {payout.source_payment_txid ?? "N/A"}</div>
                  </div>

                  <div style={rideDetailItemStyle()}>
                    <strong>Payout transfer</strong>
                    <div style={monoTextStyle()}>Payment ID: {payout.payout_payment_id ?? "Not sent yet"}</div>
                    <div style={monoTextStyle()}>TXID: {payout.payout_txid ?? "Not sent yet"}</div>
                  </div>

                  <div style={rideDetailItemStyle()}>
                    <strong>Dates</strong>
                    <div>Requested: {formatDateTime(payout.requested_at)}</div>
                    <div>Processed: {formatDateTime(payout.processed_at)}</div>
                    <div>Updated: {formatDateTime(payout.updated_at)}</div>
                  </div>
                </div>

                {payout.payout_error ? (
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
                    {payout.payout_error}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}


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
              Review recent rides, dispatch status, fare, Pi payment state,
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
              const paymentReview = getPaymentReview(payment);

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
                      <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
                        {getStatusAdminHint(ride.status)}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={badgeStyle(statusBadgeColor(ride.status))}>
                        {formatStatus(ride.status)}
                      </span>

                      <span style={badgeStyle(paymentReview.badgeBackground)}>
                        {paymentReview.label}
                      </span>
                    </div>
                  </div>

                  <div style={rideDetailGridStyle()}>
                    <div style={rideDetailItemStyle()}>
                      <strong>Rider</strong>
                      <div style={{ marginTop: 6 }}>{formatAdminRiderIdentity(ride)}</div>
                      <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
                        Pi-linked rider identity, when available.
                      </div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Driver</strong>
                      <div style={{ marginTop: 6 }}>{formatAdminDriverIdentity(ride)}</div>
                      <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
                        Driver identity for testing. Real Pi-linked driver accounts will be enabled later.
                      </div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Vehicle</strong>
                      <div style={{ marginTop: 6 }}>{formatVehicleType(ride.vehicle_type)}</div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Driver profile ID</strong>
                      <div style={{ marginTop: 6 }}>{ride.demo_driver_id ?? "Not assigned"}</div>
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
                      <strong>Driver payout</strong>
                      <div style={{ marginTop: 6 }}>
                        {ride.driver_payout_pi != null
                          ? formatPi(Number(ride.driver_payout_pi))
                          : "Not calculated yet"}
                      </div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Route source</strong>
                      <div style={{ marginTop: 6 }}>{formatRouteSource(ride.route_source)}</div>
                    </div>

                    <div style={rideDetailItemStyle()}>
                      <strong>Payment status</strong>
                      <div style={{ marginTop: 6 }}>
                        <span style={badgeStyle(paymentReview.badgeBackground)}>
                          {paymentReview.label}
                        </span>
                        <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                          Status: {payment.payment_status ?? "unpaid"}
                        </div>
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
                      background: paymentReview.background,
                      border: paymentReview.border,
                      color: paymentReview.color,
                      lineHeight: 1.6,
                    }}
                  >
                    <strong>Payment review:</strong>{" "}
{paymentReview.message}
                    <div style={monoTextStyle()}>
                      Payment ID: {payment.payment_id ?? "N/A"}
                    </div>
                    <div style={monoTextStyle()}>
                      Transaction ID: {payment.payment_txid ?? "N/A"}
                    </div>
                    <div style={monoTextStyle()}>
                      Attempts: {payment.payment_attempt_count ?? 0}
                    </div>
                    {payment.payment_last_error ? (
                      <div style={monoTextStyle()}>
                        Last error: {payment.payment_last_error}
                      </div>
                    ) : null}
                    {payment.payment_last_error_at ? (
                      <div style={monoTextStyle()}>
                        Last error at: {formatDateTime(payment.payment_last_error_at)}
                      </div>
                    ) : null}
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
