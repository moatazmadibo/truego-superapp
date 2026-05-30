import { useEffect, useState } from "react";
import { getStoredPiSession } from "../lib/pi";
import { supabase } from "../lib/supabase";
import {
  createRideCallEvent,
  createRideMessage,
  listRideMessages,
  type RideMessageRow,
  type RideRow,
} from "../services/rideApi";

function cardStyle(): React.CSSProperties {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.07)",
  };
}

function buttonStyle(background: string, disabled = false): React.CSSProperties {
  return {
    border: 0,
    borderRadius: 12,
    padding: "11px 14px",
    color: "#ffffff",
    background,
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  };
}

function quickButtonStyle(): React.CSSProperties {
  return {
    border: "1px solid #dbeafe",
    borderRadius: 999,
    padding: "8px 10px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 12,
  };
}

function messageBubbleStyle(isMine: boolean): React.CSSProperties {
  return {
    alignSelf: isMine ? "flex-end" : "flex-start",
    maxWidth: "82%",
    padding: "10px 12px",
    borderRadius: 14,
    background: isMine ? "#0ea5e9" : "#f1f5f9",
    color: isMine ? "#ffffff" : "#0f172a",
    lineHeight: 1.5,
    fontSize: 14,
  };
}

const QUICK_MESSAGES = [
  "I arrived",
  "Where are you?",
  "Please wait 2 minutes",
  "I am at the pickup point",
];

export default function RideCommunicationCard({
  ride,
  viewer,
}: {
  ride: RideRow;
  viewer: "rider" | "driver";
}) {
  const [messages, setMessages] = useState<RideMessageRow[]>([]);
  const [messageText, setMessageText] = useState("");
  const [counterpartPhone, setCounterpartPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const session = getStoredPiSession();
  const canCommunicate = [
    "driver_assigned",
    "driver_arriving",
    "in_progress",
    "completed",
  ].includes(ride.status);

  async function loadMessages() {
    const rows = await listRideMessages(ride.id);
    setMessages(rows);
  }

  async function loadCounterpartPhone() {
    if (viewer === "driver") {
      setCounterpartPhone(ride.rider_phone ?? "");
      return;
    }

    if (!ride.demo_driver_id) {
      setCounterpartPhone("");
      return;
    }

    const { data, error: phoneError } = await supabase
      .from("demo_drivers")
      .select("phone")
      .eq("id", ride.demo_driver_id)
      .maybeSingle();

    if (!phoneError) {
      const row = data as { phone?: string | null } | null;
      setCounterpartPhone(row?.phone ?? "");
    }
  }

  useEffect(() => {
    if (!canCommunicate) {
      return;
    }

    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setError("");

      try {
        await Promise.all([loadMessages(), loadCounterpartPhone()]);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load ride communication."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAll();

    const intervalId = window.setInterval(() => {
      void loadMessages();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [ride.id, ride.demo_driver_id, ride.rider_phone, canCommunicate, viewer]);

  async function sendMessage(text: string) {
    const cleanText = text.trim();

    if (!cleanText) {
      return;
    }

    setActionLoading("message");
    setError("");

    try {
      await createRideMessage({
        rideId: ride.id,
        senderRole: viewer,
        senderPiUid: session?.uid ?? null,
        senderName:
          viewer === "rider"
            ? ride.rider_name ?? session?.username ?? "Rider"
            : ride.driver_name ?? session?.username ?? "Driver",
        messageText: cleanText,
      });

      setMessageText("");
      await loadMessages();
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Failed to send message."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function startPhoneCall() {
    if (!counterpartPhone) {
      setError("The other party has not added a verified phone number yet.");
      return;
    }

    setActionLoading("call");
    setError("");

    try {
      await createRideCallEvent({
        rideId: ride.id,
        callerRole: viewer,
        callerPiUid: session?.uid ?? null,
        calleeRole: viewer === "rider" ? "driver" : "rider",
        calleePhone: counterpartPhone,
        callType: "phone",
      });

      window.location.href = `tel:${counterpartPhone}`;
    } catch (callError) {
      setError(
        callError instanceof Error ? callError.message : "Failed to start phone call."
      );
    } finally {
      setActionLoading("");
    }
  }

  if (!canCommunicate) {
    return null;
  }

  return (
    <div style={cardStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Ride communication</h2>
          <p style={{ margin: "6px 0 0", color: "#475569", lineHeight: 1.6 }}>
            Message the other party or start a normal phone call after the ride is assigned.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void startPhoneCall()}
          disabled={actionLoading !== "" || !counterpartPhone}
          style={buttonStyle("#0f766e", actionLoading !== "" || !counterpartPhone)}
        >
          {counterpartPhone ? "Call" : "Phone unavailable"}
        </button>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {QUICK_MESSAGES.map((quickMessage) => (
          <button
            key={quickMessage}
            type="button"
            onClick={() => void sendMessage(quickMessage)}
            disabled={actionLoading !== ""}
            style={quickButtonStyle()}
          >
            {quickMessage}
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: 260,
          overflowY: "auto",
          padding: 10,
          borderRadius: 14,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
        }}
      >
        {loading ? <div style={{ color: "#64748b" }}>Loading messages...</div> : null}

        {!loading && messages.length === 0 ? (
          <div style={{ color: "#64748b" }}>No messages yet.</div>
        ) : null}

        {messages.map((message) => {
          const isMine = message.sender_role === viewer;

          return (
            <div key={message.id} style={messageBubbleStyle(isMine)}>
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.85 }}>
                {message.sender_name ?? message.sender_role}
              </div>
              <div>{message.message_text}</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <input
          value={messageText}
          onChange={(event) => setMessageText(event.target.value)}
          placeholder="Write a message..."
          style={{
            flex: 1,
            padding: "11px 12px",
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            font: "inherit",
          }}
        />

        <button
          type="button"
          onClick={() => void sendMessage(messageText)}
          disabled={actionLoading !== "" || !messageText.trim()}
          style={buttonStyle("#2563eb", actionLoading !== "" || !messageText.trim())}
        >
          Send
        </button>
      </div>

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
    </div>
  );
}
