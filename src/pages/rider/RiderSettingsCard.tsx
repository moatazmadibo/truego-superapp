import type { CSSProperties } from "react";

function cardStyle(): CSSProperties {
  return {
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
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
    borderBottom: "1px solid #e5e7eb",
  };
}

function labelStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontWeight: 900,
  };
}

function subStyle(): CSSProperties {
  return {
    marginTop: 4,
    color: "#64748b",
    fontWeight: 500,
  };
}

export default function RiderSettingsCard() {
  return (
    <section id="rider-settings" style={cardStyle()}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Settings</h3>

      <p style={{ marginTop: 0, color: "#64748b", lineHeight: 1.6 }}>
        Basic app settings and important links for TrueGo Rider.
      </p>

      <div style={rowStyle()}>
        <div>
          <div style={labelStyle()}><span>🌐</span><span>Language</span></div>
          <div style={subStyle()}>English now. More languages will be added later.</div>
        </div>
        <strong>EN</strong>
      </div>

      <div style={rowStyle()}>
        <div>
          <div style={labelStyle()}><span>📏</span><span>Distance units</span></div>
          <div style={subStyle()}>Kilometres</div>
        </div>
        <span>›</span>
      </div>

      <div style={rowStyle()}>
        <div>
          <div style={labelStyle()}><span>📄</span><span>Legal documents</span></div>
          <div style={subStyle()}>Privacy policy and app information.</div>
        </div>
        <a href="/privacy" style={{ color: "#2563eb", fontWeight: 900, textDecoration: "none" }}>
          Open
        </a>
      </div>

      <div style={rowStyle()}>
        <div>
          <div style={labelStyle()}><span>💬</span><span>Support</span></div>
          <div style={subStyle()}>Join TrueGo Community for feedback and help.</div>
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
        <div>
          <div style={labelStyle()}><span>📱</span><span>App version</span></div>
          <div style={subStyle()}>Testnet community build</div>
        </div>
        <strong>0.1</strong>
      </div>
    </section>
  );
}
