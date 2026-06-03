import { useState, type CSSProperties } from "react";

export type AppDrawerItem = {
  label: string;
  icon: string;
  href: string;
  external?: boolean;
  onSelect?: () => void;
};

function menuButtonStyle(): CSSProperties {
  return {
    position: "fixed",
    top: 14,
    left: 14,
    zIndex: 1000,
    width: 48,
    height: 48,
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.18)",
    fontSize: 24,
    fontWeight: 900,
    cursor: "pointer",
  };
}

function overlayStyle(): CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex: 1001,
    background: "rgba(15, 23, 42, 0.48)",
    border: 0,
  };
}

function drawerStyle(): CSSProperties {
  return {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 1002,
    width: "min(82vw, 360px)",
    background: "#ffffff",
    boxShadow: "20px 0 50px rgba(15, 23, 42, 0.22)",
    padding: 20,
    overflowY: "auto",
  };
}

function drawerItemStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 14,
    width: "100%",
    padding: "14px 10px",
    borderRadius: 14,
    color: "#111827",
    textDecoration: "none",
    fontSize: 18,
    fontWeight: 800,
    border: "0",
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
  };
}

function scrollToHash(hash: string) {
  if (!hash.startsWith("#")) return;

  window.setTimeout(() => {
    document.querySelector(hash)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 120);
}

export default function AppSideDrawer({
  title,
  subtitle,
  appLabel,
  items,
}: {
  title: string;
  subtitle?: string;
  appLabel: string;
  items: AppDrawerItem[];
}) {
  const [open, setOpen] = useState(false);

  function closeDrawer() {
    setOpen(false);
  }

  function handleSelect(item: AppDrawerItem) {
    item.onSelect?.();
    closeDrawer();
    scrollToHash(item.href);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        style={menuButtonStyle()}
      >
        ☰
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={closeDrawer}
            style={overlayStyle()}
          />

          <aside style={drawerStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 999,
                    background: "linear-gradient(135deg, #2563eb, #22c55e, #7c3aed)",
                    color: "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 24,
                    fontWeight: 950,
                    marginBottom: 12,
                  }}
                >
                  TG
                </div>

                <div style={{ fontSize: 22, fontWeight: 950 }}>{title}</div>

                {subtitle ? (
                  <div style={{ color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
                    {subtitle}
                  </div>
                ) : null}

                <div style={{ color: "#7c3aed", marginTop: 6, fontWeight: 900 }}>
                  {appLabel}
                </div>
              </div>

              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  fontSize: 22,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ height: 1, background: "#e5e7eb", margin: "18px 0" }} />

            <nav style={{ display: "grid", gap: 4 }}>
              {items.map((item) => {
                if (item.onSelect) {
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleSelect(item)}
                      style={drawerItemStyle()}
                    >
                      <span style={{ width: 28, textAlign: "center" }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                }

                if (item.external) {
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={closeDrawer}
                      style={drawerItemStyle()}
                    >
                      <span style={{ width: 28, textAlign: "center" }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </a>
                  );
                }

                return (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => {
                      closeDrawer();
                      scrollToHash(item.href);
                    }}
                    style={drawerItemStyle()}
                  >
                    <span style={{ width: 28, textAlign: "center" }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>

            <div
              style={{
                marginTop: 22,
                padding: 12,
                borderRadius: 14,
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                color: "#475569",
                lineHeight: 1.6,
              }}
            >
              TrueGo — Ride, Offer, Track, Pay with Pi.
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
