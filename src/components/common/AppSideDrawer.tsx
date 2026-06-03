import { useMemo, useState, type CSSProperties } from "react";

export type AppDrawerItem = {
  label: string;
  icon: string;
  href: string;
  external?: boolean;
  onSelect?: () => void;
};

type PiSessionSummary = {
  username: string;
  uid: string;
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

function avatarStyle(): CSSProperties {
  return {
    width: 72,
    height: 72,
    borderRadius: 999,
    background: "linear-gradient(135deg, #2563eb, #22c55e, #7c3aed)",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    fontSize: 22,
    fontWeight: 950,
    marginBottom: 12,
    overflow: "hidden",
  };
}

function shortenUid(uid: string) {
  return uid.length > 14 ? `${uid.slice(0, 8)}…${uid.slice(-6)}` : uid;
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function findPiSessionSummary(): PiSessionSummary | null {
  if (typeof window === "undefined") return null;

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as unknown;
      const candidates: Record<string, unknown>[] = [];

      if (parsed && typeof parsed === "object") {
        candidates.push(parsed as Record<string, unknown>);

        const user = (parsed as Record<string, unknown>).user;
        if (user && typeof user === "object") {
          candidates.push(user as Record<string, unknown>);
        }

        const piUser = (parsed as Record<string, unknown>).piUser;
        if (piUser && typeof piUser === "object") {
          candidates.push(piUser as Record<string, unknown>);
        }
      }

      for (const candidate of candidates) {
        const username = pickString(candidate, ["username", "pi_username", "piUsername"]);
        const uid = pickString(candidate, ["uid", "pi_uid", "piUid", "user_uid"]);

        if (username || uid) {
          return { username, uid };
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

function scrollToHash(hash: string) {
  if (!hash.startsWith("#")) return;

  const delays = [80, 260, 600, 1000];

  delays.forEach((delay) => {
    window.setTimeout(() => {
      document.querySelector(hash)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, delay);
  });
}

export default function AppSideDrawer({
  title,
  subtitle,
  appLabel,
  avatarUrl,
  avatarText = "TG",
  items,
}: {
  title: string;
  subtitle?: string;
  appLabel: string;
  avatarUrl?: string;
  avatarText?: string;
  items: AppDrawerItem[];
}) {
  const [open, setOpen] = useState(false);

  const piSummary = useMemo(() => findPiSessionSummary(), [open]);

  const resolvedSubtitle =
    subtitle && subtitle !== "Pi rider account"
      ? subtitle
      : piSummary?.username || piSummary?.uid
        ? `${piSummary.username ? `@${piSummary.username}` : "Pi user"}${piSummary.uid ? ` · UID ${shortenUid(piSummary.uid)}` : ""}`
        : subtitle;

  function closeDrawer() {
    setOpen(false);
  }

  function handleInternalItem(item: AppDrawerItem) {
    item.onSelect?.();
    closeDrawer();
    scrollToHash(item.href);
  }

  return (
    <>
      <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} style={menuButtonStyle()}>
        ☰
      </button>

      {open ? (
        <>
          <button type="button" aria-label="Close menu" onClick={closeDrawer} style={overlayStyle()} />

          <aside style={drawerStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={avatarStyle()}>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`${title} profile`}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    avatarText.slice(0, 2).toUpperCase()
                  )}
                </div>

                <div style={{ fontSize: 22, fontWeight: 950 }}>{title}</div>

                {resolvedSubtitle ? (
                  <div style={{ color: "#64748b", marginTop: 4, lineHeight: 1.5 }}>
                    {resolvedSubtitle}
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
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleInternalItem(item)}
                    style={drawerItemStyle()}
                  >
                    <span style={{ width: 28, textAlign: "center" }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
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
