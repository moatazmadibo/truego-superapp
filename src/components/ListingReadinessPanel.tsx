import type { CSSProperties } from "react";

type ListingReadinessContext = "landing" | "rider" | "driver" | "admin";

type ListingReadinessPanelProps = {
  context?: ListingReadinessContext;
  compact?: boolean;
};

const contextCopy: Record<ListingReadinessContext, { title: string; subtitle: string }> = {
  landing: {
    title: "TrueGo listing-ready demo",
    subtitle:
      "A Pi Network ride-hailing demo with authenticated rider, driver, admin, Test-Pi payment, and driver verification workflows.",
  },
  rider: {
    title: "Rider flow",
    subtitle:
      "Book a ride, receive a fare estimate, track trip status, and complete payment using Test-Pi.",
  },
  driver: {
    title: "Driver console",
    subtitle:
      "Drivers can go online, receive offers, accept or decline trips, complete rides, and manage verification documents.",
  },
  admin: {
    title: "Admin review console",
    subtitle:
      "Monitor rides, payments, driver verification requests, and required document readiness in separate tabs.",
  },
};

function panelStyle(compact: boolean): CSSProperties {
  return {
    marginTop: compact ? 12 : 16,
    marginBottom: compact ? 12 : 16,
    padding: compact ? 14 : 16,
    borderRadius: 16,
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 55%, #ecfdf5 100%)",
    border: "1px solid #bfdbfe",
    textAlign: "left",
  };
}

function pillStyle(background: string, color: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    background,
    color,
    fontWeight: 800,
    fontSize: 12,
    marginRight: 6,
    marginTop: 8,
  };
}

export default function ListingReadinessPanel({
  context = "landing",
  compact = false,
}: ListingReadinessPanelProps) {
  const copy = contextCopy[context];

  return (
    <div style={panelStyle(compact)}>
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
          <div
            style={{
              display: "inline-flex",
              borderRadius: 999,
              padding: "6px 10px",
              background: "#dbeafe",
              color: "#1d4ed8",
              fontSize: 12,
              fontWeight: 900,
              marginBottom: 8,
            }}
          >
            Pi Network Testnet Demo
          </div>

          <h2 style={{ margin: 0, color: "#0f172a", fontSize: compact ? 20 : 24 }}>
            {copy.title}
          </h2>

          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              color: "#475569",
              lineHeight: 1.6,
              fontSize: compact ? 14 : 15,
            }}
          >
            {copy.subtitle}
          </p>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <span style={pillStyle("#dcfce7", "#166534")}>Pi SDK Auth</span>
        <span style={pillStyle("#ede9fe", "#6d28d9")}>Test-Pi Payment</span>
        <span style={pillStyle("#fef3c7", "#92400e")}>Driver KYC</span>
        <span style={pillStyle("#e0f2fe", "#0369a1")}>Admin Review</span>
      </div>

      {!compact ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.72)",
            border: "1px solid rgba(148,163,184,0.35)",
            color: "#334155",
            lineHeight: 1.7,
          }}
        >
          <strong>Review note:</strong> TrueGo currently uses demo drivers and Test-Pi
          payments for listing review. Driver document verification is separated from
          ride/payment monitoring to keep admin operations clear and auditable.
        </div>
      ) : null}
    </div>
  );
}
