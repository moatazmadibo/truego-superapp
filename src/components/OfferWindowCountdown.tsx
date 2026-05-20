import { useEffect, useState } from "react";

type OfferWindowCountdownProps = {
  offerExpiresAt?: string | null;
};

function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function OfferWindowCountdown({
  offerExpiresAt,
}: OfferWindowCountdownProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!offerExpiresAt) {
      setSecondsRemaining(null);
      return;
    }

    const expiresAt = Date.parse(offerExpiresAt);

    if (!Number.isFinite(expiresAt)) {
      setSecondsRemaining(null);
      return;
    }

    function tick() {
      setSecondsRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    }

    tick();

    const intervalId = window.setInterval(tick, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [offerExpiresAt]);

  if (secondsRemaining == null) {
    return null;
  }

  const isEndingSoon = secondsRemaining <= 15;

  return (
    <div
      style={{
        marginTop: 12,
        padding: "12px 14px",
        borderRadius: 16,
        background: isEndingSoon ? "#fef2f2" : "#eef2ff",
        border: isEndingSoon ? "1px solid #fecaca" : "1px solid #c7d2fe",
        color: isEndingSoon ? "#b91c1c" : "#3730a3",
        fontWeight: 900,
        lineHeight: 1.5,
      }}
    >
      Offer window closes in {formatCountdown(secondsRemaining)}
    </div>
  );
}
