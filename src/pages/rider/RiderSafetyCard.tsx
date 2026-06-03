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

function gridStyle(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
    marginTop: 12,
  };
}

function tileStyle(): CSSProperties {
  return {
    minHeight: 108,
    padding: 14,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    display: "grid",
    alignContent: "space-between",
    lineHeight: 1.35,
  };
}

function actionTileStyle(): CSSProperties {
  return {
    ...tileStyle(),
    color: "#111827",
    textDecoration: "none",
  };
}

export default function RiderSafetyCard() {
  return (
    <section id="rider-safety" style={cardStyle()}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Safety</h3>

      <p style={{ marginTop: 0, color: "#64748b", lineHeight: 1.6 }}>
        Safety guidance for TrueGo riders during community testing and real ride preparation.
      </p>

      <div style={gridStyle()}>
        <a href="https://t.me/truego_community" target="_blank" rel="noreferrer" style={actionTileStyle()}>
          <div style={{ fontSize: 30 }}>💬</div>
          <strong>Support</strong>
          <span style={{ color: "#64748b" }}>Ask for help in the community group.</span>
        </a>

        <div style={tileStyle()}>
          <div style={{ fontSize: 30 }}>✅</div>
          <strong>Driver verification</strong>
          <span style={{ color: "#64748b" }}>Use approved drivers during real operations.</span>
        </div>

        <div style={tileStyle()}>
          <div style={{ fontSize: 30 }}>🔒</div>
          <strong>Protecting privacy</strong>
          <span style={{ color: "#64748b" }}>Do not share wallet passphrases or private data.</span>
        </div>

        <div style={tileStyle()}>
          <div style={{ fontSize: 30 }}>🛡️</div>
          <strong>Staying safe</strong>
          <span style={{ color: "#64748b" }}>Confirm driver and ride details before starting.</span>
        </div>

        <div style={tileStyle()}>
          <div style={{ fontSize: 30 }}>⚠️</div>
          <strong>Report an issue</strong>
          <span style={{ color: "#64748b" }}>Send screenshots and ride details if something fails.</span>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 16,
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#991b1b",
          lineHeight: 1.6,
        }}
      >
        <strong>Emergency note:</strong> TrueGo is currently in community testing. For real emergencies, contact your local emergency number immediately.
      </div>
    </section>
  );
}
