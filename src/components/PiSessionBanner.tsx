import { getStoredPiSession } from "../lib/pi";

type PiSessionBannerProps = {
  appLabel?: string;
};

export default function PiSessionBanner({ appLabel = "TrueGo" }: PiSessionBannerProps) {
  const session = getStoredPiSession();

  if (!session) {
    return null;
  }

  const displayName = session.username
    ? `@${session.username}`
    : `Pi user ${session.uid.slice(0, 8)}...`;

  return (
    <div
      style={{
        marginTop: 12,
        marginBottom: 12,
        padding: "10px 14px",
        borderRadius: 14,
        background: "#ecfdf5",
        border: "1px solid #bbf7d0",
        color: "#065f46",
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1.5,
      }}
    >
      {appLabel} · Logged in as <strong>{displayName}</strong>
    </div>
  );
}
