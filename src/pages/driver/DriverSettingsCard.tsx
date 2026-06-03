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

export default function DriverSettingsCard() {
  return (
    <section id="driver-settings" style={cardStyle()}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>App Settings</h3>

      <p style={{ marginTop: 0, color: "#64748b", lineHeight: 1.6 }}>
        Basic settings and support links for TrueGo Driver during Testnet community testing.
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
          <span style={iconStyle()}>🌐</span>
          <div>
            <strong>Language</strong>
            <div style={{ color: "#64748b" }}>Default language</div>
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
            <div style={{ color: "#64748b" }}>Privacy policy</div>
          </div>
        </div>
        <span style={{ color: "#94a3b8" }}>›</span>
      </div>

      <div style={rowStyle()}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={iconStyle()}>📱</span>
          <div>
            <strong>App version</strong>
            <div style={{ color: "#64748b" }}>{TRUEGO_APP_VERSION}</div>
          </div>
        </div>
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
            <div style={{ color: "#64748b" }}>TrueGo Community</div>
          </div>
        </div>
        <span style={{ color: "#94a3b8" }}>›</span>
      </div>

      <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", lineHeight: 1.6 }}>
        Some settings are informational during Testnet. More driver preferences will be enabled after public testing feedback.
      </div>
    </section>
  );
}
