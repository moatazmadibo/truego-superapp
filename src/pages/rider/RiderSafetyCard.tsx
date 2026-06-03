import type { CSSProperties } from "react";

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

function itemStyle(): CSSProperties {
  return {
    padding: 12,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    lineHeight: 1.6,
  };
}

export default function RiderSafetyCard() {
  return (
    <section id="rider-safety" style={cardStyle()}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Safety</h3>

      <p style={{ marginTop: 0, color: "#64748b", lineHeight: 1.6 }}>
        Basic safety guidance for TrueGo riders during community testing.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={itemStyle()}>
          <strong>Confirm driver details</strong>
          <div>Before starting the trip, check the driver name and ride information inside the app.</div>
        </div>

        <div style={itemStyle()}>
          <strong>Use Pi payment only after trip completion</strong>
          <div>Pay only after the ride is completed and the app shows the correct payment step.</div>
        </div>

        <div style={itemStyle()}>
          <strong>Share feedback</strong>
          <div>
            If you face any issue, report it in the TrueGo Community group with screenshots when possible.
          </div>
        </div>
      </div>
    </section>
  );
}
