import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../../lib/supabase";

export type AppNotificationReminder = {
  dedupeKey: string;
  title: string;
  body: string;
  type?: string;
  actionUrl?: string;
};

type NotificationRow = {
  id: string;
  target_app: string;
  title: string;
  body: string;
  notification_type: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

function findPiIdentityFromStorage() {
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") continue;

      const record = parsed as Record<string, unknown>;
      const user = record.user && typeof record.user === "object"
        ? (record.user as Record<string, unknown>)
        : null;

      const uid =
        (typeof record.uid === "string" ? record.uid : "") ||
        (typeof user?.uid === "string" ? user.uid : "");

      const username =
        (typeof record.username === "string" ? record.username : "") ||
        (typeof user?.username === "string" ? user.username : "");

      if (uid || username) {
        return { uid, username };
      }
    }
  } catch {
    return { uid: "", username: "" };
  }

  return { uid: "", username: "" };
}

function buttonStyle(): CSSProperties {
  return {
    position: "fixed",
    top: 14,
    right: 14,
    zIndex: 1000,
    width: 48,
    height: 48,
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.18)",
    fontSize: 22,
    cursor: "pointer",
  };
}

function panelStyle(): CSSProperties {
  return {
    position: "fixed",
    top: 70,
    right: 12,
    zIndex: 1003,
    width: "min(92vw, 380px)",
    maxHeight: "70vh",
    overflowY: "auto",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    boxShadow: "0 22px 60px rgba(15, 23, 42, 0.28)",
    padding: 14,
  };
}

function notificationItemStyle(unread: boolean): CSSProperties {
  return {
    padding: 12,
    borderRadius: 14,
    background: unread ? "#eff6ff" : "#f8fafc",
    border: unread ? "1px solid #bfdbfe" : "1px solid #e5e7eb",
    marginTop: 10,
    lineHeight: 1.5,
  };
}

function badgeStyle(): CSSProperties {
  return {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    background: "#dc2626",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 900,
    display: "grid",
    placeItems: "center",
    padding: "0 5px",
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function AppNotificationBell({
  targetApp,
  piUid,
  piUsername,
  demoDriverId,
  reminders = [],
  onNavigate,
}: {
  targetApp: "rider" | "driver";
  piUid?: string | null;
  piUsername?: string | null;
  demoDriverId?: string | null;
  reminders?: AppNotificationReminder[];
  onNavigate?: (actionUrl: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const storedIdentity = useMemo(() => findPiIdentityFromStorage(), []);
  const resolvedUid = piUid || storedIdentity.uid;
  const resolvedUsername = piUsername || storedIdentity.username;
  const resolvedDemoDriverId = demoDriverId || "";

  const identityKey =
    resolvedDemoDriverId || resolvedUid || resolvedUsername || "unknown";

  async function registerCurrentUser() {
    if (!resolvedDemoDriverId && !resolvedUid && !resolvedUsername) {
      return;
    }

    await supabase.rpc("register_app_user_profile", {
      p_target_app: targetApp,
      p_pi_uid: resolvedUid || null,
      p_pi_username: resolvedUsername || null,
      p_demo_driver_id: resolvedDemoDriverId || null,
    });
  }

  async function loadNotifications() {
    if (!resolvedDemoDriverId && !resolvedUid && !resolvedUsername) {
      setNotifications([]);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc("list_user_notifications", {
        p_target_app: targetApp,
        p_pi_uid: resolvedUid || null,
        p_pi_username: resolvedUsername || null,
        p_demo_driver_id: resolvedDemoDriverId || null,
        p_limit: 20,
      });

      if (error) throw error;

      setNotifications((data ?? []) as NotificationRow[]);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    await supabase.rpc("mark_user_notification_read", {
      p_notification_id: id,
    });

    setNotifications((current) =>
      current.map((item) =>
        item.id === id ? { ...item, read_at: new Date().toISOString() } : item
      )
    );
  }

  function goToAction(notification: NotificationRow) {
    void markRead(notification.id);

    const actionUrl = notification.action_url;
    if (!actionUrl) return;

    if (onNavigate) {
      onNavigate(actionUrl);
      setOpen(false);
      return;
    }

    if (actionUrl.startsWith("#")) {
      document.querySelector(actionUrl)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setOpen(false);
      return;
    }

    window.location.href = actionUrl;
  }

  useEffect(() => {
    void registerCurrentUser().then(() => {
      void loadNotifications();
    });
  }, [targetApp, resolvedUid, resolvedUsername, resolvedDemoDriverId]);

  useEffect(() => {
    if (!identityKey || identityKey === "unknown" || reminders.length === 0) return;

    void Promise.all(
      reminders.map((reminder) =>
        supabase.rpc("upsert_user_notification", {
          p_target_app: targetApp,
          p_target_pi_uid: resolvedUid || null,
          p_target_pi_username: resolvedUsername || null,
          p_target_demo_driver_id: resolvedDemoDriverId || null,
          p_title: reminder.title,
          p_body: reminder.body,
          p_notification_type: reminder.type ?? "reminder",
          p_action_url: reminder.actionUrl ?? null,
          p_dedupe_key: `${targetApp}:${identityKey}:${reminder.dedupeKey}`,
        })
      )
    ).then(() => {
      void loadNotifications();
    });
  }, [targetApp, identityKey, resolvedUid, resolvedUsername, resolvedDemoDriverId, JSON.stringify(reminders)]);

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  return (
    <>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((value) => !value)}
        style={buttonStyle()}
      >
        🔔
        {unreadCount > 0 ? <span style={badgeStyle()}>{unreadCount}</span> : null}
      </button>

      {open ? (
        <section style={panelStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>Notifications</h3>
              <div style={{ color: "#64748b", marginTop: 4 }}>
                {unreadCount} unread
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>

          {loading ? (
            <div style={{ marginTop: 14, color: "#64748b" }}>Loading notifications...</div>
          ) : null}

          {!loading && notifications.length === 0 ? (
            <div style={{ marginTop: 14, color: "#64748b" }}>
              No notifications yet.
            </div>
          ) : null}

          {notifications.map((notification) => {
            const unread = !notification.read_at;

            return (
              <div key={notification.id} style={notificationItemStyle(unread)}>
                <strong>{notification.title}</strong>
                <div style={{ marginTop: 4, color: "#334155" }}>
                  {notification.body}
                </div>
                <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 12 }}>
                  {formatDate(notification.created_at)}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {notification.action_url ? (
                    <button
                      type="button"
                      onClick={() => goToAction(notification)}
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 999,
                        background: "#ffffff",
                        padding: "8px 10px",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Open
                    </button>
                  ) : null}

                  {unread ? (
                    <button
                      type="button"
                      onClick={() => void markRead(notification.id)}
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 999,
                        background: "#ffffff",
                        padding: "8px 10px",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>
      ) : null}
    </>
  );
}
