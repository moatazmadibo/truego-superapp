import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";

type DriverWalletProfile = {
  id: string;
  display_name?: string | null;
  pi_uid?: string | null;
  pi_username?: string | null;
  payout_wallet_address?: string | null;
  payout_wallet_address_updated_at?: string | null;
  payout_wallet_verified_at?: string | null;
};

function cardStyle(): CSSProperties {
  return {
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
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
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
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

export default function DriverPayoutWalletCard({
  driver,
}: {
  driver: DriverWalletProfile | null;
}) {
  const [walletAddress, setWalletAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setWalletAddress(driver?.payout_wallet_address ?? "");
    setMessage("");
    setError("");
  }, [driver?.id, driver?.payout_wallet_address]);

  async function saveWalletAddress() {
    const value = walletAddress.trim().toUpperCase();

    if (!driver?.id) {
      setError("Driver profile is not loaded yet.");
      return;
    }

    if (!isLikelyPiWalletAddress(value)) {
      setError(
        "Invalid wallet address. Open Pi Wallet → Receive, then copy your public wallet address. Never enter your passphrase."
      );
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("demo_drivers")
        .update({
          payout_wallet_address: value,
          payout_wallet_address_updated_at: new Date().toISOString(),
        })
        .eq("id", driver.id);

      if (updateError) throw updateError;

      setMessage("Pi Wallet public address saved. Admin can now review it for manual payouts.");
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Failed to save wallet address."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={cardStyle()}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Payout Wallet</h3>

      <p style={{ marginTop: 0, color: "#64748b", lineHeight: 1.6 }}>
        Add your Pi Wallet public address so Admin can send your driver payout manually after completed paid rides.
      </p>

      <div
        style={{
          padding: 12,
          borderRadius: 12,
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          color: "#1e3a8a",
          lineHeight: 1.6,
          marginBottom: 12,
        }}
      >
        <strong>Safety notice</strong>
        <div>
          Only enter your public wallet address from <strong>Pi Wallet → Receive</strong>.
          Never share your passphrase, seed phrase, private key, or wallet password.
        </div>
      </div>

      <label style={{ display: "block", fontWeight: 800, marginBottom: 6 }}>
        Pi Wallet Public Address
      </label>

      <input
        value={walletAddress}
        onChange={(event) => {
          setWalletAddress(event.target.value.toUpperCase());
        }}
        placeholder="G......................................................."
        style={inputStyle()}
      />

      <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
        Wallet updated: {formatDate(driver?.payout_wallet_address_updated_at)}
      </div>

      <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
        Admin verified: {formatDate(driver?.payout_wallet_verified_at)}
      </div>

      {driver?.pi_username ? (
        <div style={{ marginTop: 8 }}>
          Pi account: <strong>@{driver.pi_username}</strong>
        </div>
      ) : null}

      {driver?.pi_uid ? <div style={monoStyle()}>Pi UID: {driver.pi_uid}</div> : null}

      {message ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "#ecfdf5",
            border: "1px solid #bbf7d0",
            color: "#047857",
          }}
        >
          {message}
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void saveWalletAddress()}
        disabled={saving || !driver?.id}
        style={{ ...buttonStyle(saving || !driver?.id), marginTop: 12 }}
      >
        {saving ? "Saving..." : "Save payout wallet"}
      </button>
    </section>
  );
}
