import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { requireAdminSessionToken } from "../../components/admin/adminSession";
import { supabase } from "../../lib/supabase";

type DriverWalletRow = {
  demo_driver_id: string;
  display_name: string | null;
  pi_uid: string | null;
  pi_username: string | null;
  account_status: string | null;
  onboarding_status: string | null;
  payout_wallet_address: string | null;
  payout_wallet_address_updated_at: string | null;
  payout_wallet_verified_at: string | null;
  payout_wallet_verified_by: string | null;
};

function sectionStyle(): CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  };
}

function gridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
    marginTop: 12,
  };
}

function itemStyle(): CSSProperties {
  return {
    padding: 12,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    lineHeight: 1.5,
  };
}

function inputStyle(): CSSProperties {
  return {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    font: "inherit",
    boxSizing: "border-box",
  };
}

function buttonStyle(disabled = false): CSSProperties {
  return {
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "10px 14px",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
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

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "N/A";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;

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

function isLikelyPiWalletAddress(value: string) {
  return /^G[A-Z0-9]{55}$/.test(value.trim().toUpperCase());
}

export default function AdminDriverWalletsPanel() {
  const [rows, setRows] = useState<DriverWalletRow[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadWallets() {
    setLoading(true);
    setError("");

    try {
      const { data, error: walletsError } = await supabase.rpc(
        "admin_list_driver_payout_wallets",
        {
          p_admin_session_token: requireAdminSessionToken(),
        }
      );

      if (walletsError) throw walletsError;

      const nextRows = (data ?? []) as unknown as DriverWalletRow[];
      setRows(nextRows);

      const selectedStillExists = nextRows.some(
        (row) => row.demo_driver_id === selectedDriverId
      );

      const nextSelected =
        selectedStillExists ? selectedDriverId : nextRows[0]?.demo_driver_id ?? "";

      setSelectedDriverId(nextSelected);

      const selectedRow = nextRows.find((row) => row.demo_driver_id === nextSelected);
      setWalletAddress(selectedRow?.payout_wallet_address ?? "");
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load driver wallets."));
    } finally {
      setLoading(false);
    }
  }

  async function saveWalletAddress() {
    const value = walletAddress.trim().toUpperCase();

    if (!selectedDriverId) {
      setError("Select a driver first.");
      return;
    }

    if (!isLikelyPiWalletAddress(value)) {
      setError(
        "Invalid wallet address. Ask the driver to copy the public address from Pi Wallet → Receive. Never ask for passphrase."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const { error: saveError } = await supabase.rpc(
        "admin_update_driver_payout_wallet_address",
        {
          p_admin_session_token: requireAdminSessionToken(),
          p_demo_driver_id: selectedDriverId,
          p_wallet_address: value,
        }
      );

      if (saveError) throw saveError;

      setMessage("Driver payout wallet address saved and verified.");
      await loadWallets();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Failed to save driver wallet address."));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadWallets();
  }, []);

  const selectedDriver = useMemo(
    () => rows.find((row) => row.demo_driver_id === selectedDriverId) ?? null,
    [rows, selectedDriverId]
  );

  const stats = useMemo(() => {
    return {
      total: rows.length,
      withWallet: rows.filter((row) => row.payout_wallet_address).length,
      missingWallet: rows.filter((row) => !row.payout_wallet_address).length,
      verified: rows.filter((row) => row.payout_wallet_verified_at).length,
    };
  }, [rows]);

  return (
    <div style={sectionStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Driver Payout Wallets</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.6 }}>
            Store only the driver's Pi Wallet public address for manual payouts. Never request passphrase, seed phrase, or private key.
          </p>
        </div>

        <button type="button" onClick={() => void loadWallets()} disabled={loading} style={buttonStyle(loading)}>
          {loading ? "Loading..." : "Refresh wallets"}
        </button>
      </div>

      {message ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#047857" }}>
          {message}
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }}>
          {error}
        </div>
      ) : null}

      <div style={gridStyle()}>
        <div style={itemStyle()}><strong>Total drivers</strong><div>{stats.total}</div></div>
        <div style={itemStyle()}><strong>With wallet</strong><div>{stats.withWallet}</div></div>
        <div style={itemStyle()}><strong>Missing wallet</strong><div>{stats.missingWallet}</div></div>
        <div style={itemStyle()}><strong>Verified wallets</strong><div>{stats.verified}</div></div>
      </div>

      <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
        <strong>Safety instruction for drivers</strong>
        <p style={{ marginBottom: 0, color: "#334155", lineHeight: 1.6 }}>
          Ask the driver to open Pi Wallet → Receive → Copy public wallet address. Do not ask for passphrase, seed phrase, private key, or wallet password.
        </p>
      </div>

      <div style={gridStyle()}>
        <div style={itemStyle()}>
          <strong>Select driver</strong>
          <select
            value={selectedDriverId}
            onChange={(event) => {
              const nextId = event.target.value;
              setSelectedDriverId(nextId);
              const nextDriver = rows.find((row) => row.demo_driver_id === nextId);
              setWalletAddress(nextDriver?.payout_wallet_address ?? "");
            }}
            style={{ ...inputStyle(), marginTop: 8 }}
          >
            {rows.map((row) => (
              <option key={row.demo_driver_id} value={row.demo_driver_id}>
                {row.display_name ?? "Unknown driver"} {row.pi_username ? `(@${row.pi_username})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={itemStyle()}>
          <strong>Selected driver</strong>
          <div>{selectedDriver?.display_name ?? "N/A"}</div>
          <div>{selectedDriver?.pi_username ? `@${selectedDriver.pi_username}` : "No Pi username"}</div>
          <div style={monoStyle()}>{selectedDriver?.pi_uid ?? "No Pi UID"}</div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "#f8fafc", border: "1px solid #e5e7eb" }}>
        <strong>Pi Wallet Public Address</strong>
        <input
          value={walletAddress}
          onChange={(event) => setWalletAddress(event.target.value.toUpperCase())}
          placeholder="G......................................................."
          style={{ ...inputStyle(), marginTop: 8, fontFamily: "ui-monospace, monospace" }}
        />

        <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
          Verified at: {formatDate(selectedDriver?.payout_wallet_verified_at)}
        </div>

        <button
          type="button"
          onClick={() => void saveWalletAddress()}
          disabled={saving || !selectedDriverId}
          style={{ ...buttonStyle(saving || !selectedDriverId), marginTop: 12 }}
        >
          {saving ? "Saving..." : "Save wallet address"}
        </button>
      </div>
    </div>
  );
}
