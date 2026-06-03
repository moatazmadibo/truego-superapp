import type { CSSProperties } from "react";
import { TRUEGO_APP_VERSION } from "../../lib/truegoAppVersion";

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

function rowStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 0",
    borderBottom: "1px solid #eef2f7",
  };
}

function iconStyle(): CSSProperties {
  return {
    width: 34,
    textAlign: "center",
    fontSize: 22,
  };
}

function linkStyle(): CSSProperties {
  return {
    color: "#111827",
    textDecoration: "none",
    fontWeight: 900,
  };
}

export default function RiderSettingsCard() {
  return (
    <section id="rider-settings" style={cardStyle()}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>App Settings</h3>

      <p style={{ marginTop: 0, color: "#64748b", lineHeight: 1.6 }}>
        Basic app settings and important links for TrueGo Rider.
      </p>

      <div style={rowStyle()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={iconStyle()}>🌙</span>
          <div>
            <strong>Appearance</strong>
            <div style={{ color: "#64748b" }}>System default</div>
          </div>
        </div>
        <span style={{ color: "#94a3b8" }}>›</span>
      </div>

      <div style={rowStyle()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={iconStyle()}>🌐</span>
          <div>
            <strong>Language</strong>
            <div style={{ color: "#64748b" }}>English now. More languages will be added later.</div>
          </div>
        </div>
        <strong style={{ color: "#111827" }}>EN</strong>
      </div>

      <div style={rowStyle()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={iconStyle()}>📏</span>
          <div>
            <strong>Distance units</strong>
            <div style={{ color: "#64748b" }}>Kilometres</div>
          </div>
        </div>
        <span style={{ color: "#94a3b8" }}>›</span>
      </div>

      <div style={rowStyle()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={iconStyle()}>📄</span>
          <div>
            <a href="/privacy" target="_blank" rel="noreferrer" style={linkStyle()}>
              Legal documents
            </a>
            <div style={{ color: "#64748b" }}>Privacy policy and app information.</div>
          </div>
        </div>
        <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 900, textDecoration: "none" }}>
          Open
        </a>
      </div>

      <div style={rowStyle()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={iconStyle()}>💬</span>
          <div>
            <a
              href="https://t.me/truego_community"
              target="_blank"
              rel="noreferrer"
              style={linkStyle()}
            >
              Support
            </a>
            <div style={{ color: "#64748b" }}>Join TrueGo Community for feedback and help.</div>
          </div>
        </div>
        <a
          href="https://t.me/truego_community"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#2563eb", fontWeight: 900, textDecoration: "none" }}
        >
          Join
        </a>
      </div>

      <div style={{ ...rowStyle(), borderBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={iconStyle()}>📱</span>
          <div>
            <strong>App version</strong>
            <div style={{ color: "#64748b" }}>Testnet community build</div>
          </div>
        </div>
        <strong>{TRUEGO_APP_VERSION}</strong>
      </div>
    </section>
  );
}
