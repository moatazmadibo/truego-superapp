import { useEffect, useState } from "react";

type RouteEtaSummaryProps = {
  startLat?: number | null;
  startLng?: number | null;
  targetLat?: number | null;
  targetLng?: number | null;
  targetLabel: string;
};

type OsrmRouteResponse = {
  routes?: Array<{
    distance?: number;
    duration?: number;
  }>;
};

type RouteEtaState = {
  distanceKm: number | null;
  durationMin: number | null;
  source: "osrm" | "fallback" | "unavailable";
  loading: boolean;
};

const osrmBaseUrl =
  (import.meta.env.VITE_OSRM_BASE_URL as string | undefined) ||
  "https://router.project-osrm.org";

function isValidNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(
  startLat: number,
  startLng: number,
  targetLat: number,
  targetLng: number
) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(targetLat - startLat);
  const deltaLng = toRadians(targetLng - startLng);

  const part =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(startLat)) *
      Math.cos(toRadians(targetLat)) *
      Math.sin(deltaLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(part), Math.sqrt(1 - part));
}

function wrapperStyle(source: RouteEtaState["source"]): React.CSSProperties {
  return {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    background: source === "osrm" ? "#ecfdf5" : "#fff7ed",
    border: source === "osrm" ? "1px solid #bbf7d0" : "1px solid #fed7aa",
    color: source === "osrm" ? "#047857" : "#9a3412",
    lineHeight: 1.6,
    fontSize: 14,
  };
}

function statGridStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 8,
    marginTop: 10,
  };
}

function statItemStyle(): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 12,
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(148,163,184,0.32)",
  };
}

export default function RouteEtaSummary({
  startLat,
  startLng,
  targetLat,
  targetLng,
  targetLabel,
}: RouteEtaSummaryProps) {
  const [state, setState] = useState<RouteEtaState>({
    distanceKm: null,
    durationMin: null,
    source: "unavailable",
    loading: false,
  });

  useEffect(() => {
    if (
      !isValidNumber(startLat) ||
      !isValidNumber(startLng) ||
      !isValidNumber(targetLat) ||
      !isValidNumber(targetLng)
    ) {
      setState({
        distanceKm: null,
        durationMin: null,
        source: "unavailable",
        loading: false,
      });
      return;
    }

    const controller = new AbortController();

    async function loadEta() {
      const sLat = Number(startLat);
      const sLng = Number(startLng);
      const tLat = Number(targetLat);
      const tLng = Number(targetLng);

      setState((current) => ({ ...current, loading: true }));

      try {
        const url =
          `${osrmBaseUrl}/route/v1/driving/` +
          `${sLng},${sLat};${tLng},${tLat}` +
          "?overview=false";

        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`OSRM ETA failed: ${response.status}`);
        }

        const data = (await response.json()) as OsrmRouteResponse;
        const route = data.routes?.[0];

        if (!route?.distance || !route?.duration) {
          throw new Error("OSRM returned no ETA route.");
        }

        setState({
          distanceKm: Number((route.distance / 1000).toFixed(2)),
          durationMin: Math.max(1, Math.ceil(route.duration / 60)),
          source: "osrm",
          loading: false,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.warn("ETA fallback:", error);

        const distanceKm = haversineDistanceKm(sLat, sLng, tLat, tLng);
        const durationMin = Math.max(1, Math.ceil((distanceKm / 35) * 60));

        setState({
          distanceKm: Number(distanceKm.toFixed(2)),
          durationMin,
          source: "fallback",
          loading: false,
        });
      }
    }

    void loadEta();

    return () => {
      controller.abort();
    };
  }, [startLat, startLng, targetLat, targetLng]);

  if (state.source === "unavailable") {
    return (
      <div style={wrapperStyle("fallback")}>
        <strong>ETA to {targetLabel}:</strong> waiting for driver location.
      </div>
    );
  }

  return (
    <div style={wrapperStyle(state.source)}>
      <strong>ETA to {targetLabel}</strong>
      <div style={{ marginTop: 4 }}>
        {state.loading
          ? "Calculating road distance and ETA..."
          : state.source === "osrm"
            ? "Based on OSRM road route."
            : "OSRM unavailable. Showing safe fallback estimate."}
      </div>

      <div style={statGridStyle()}>
        <div style={statItemStyle()}>
          <strong>Distance</strong>
          <div>{state.distanceKm != null ? `${state.distanceKm} km` : "N/A"}</div>
        </div>

        <div style={statItemStyle()}>
          <strong>ETA</strong>
          <div>{state.durationMin != null ? `${state.durationMin} min` : "N/A"}</div>
        </div>

        <div style={statItemStyle()}>
          <strong>Source</strong>
          <div>{state.source === "osrm" ? "OSRM" : "Fallback"}</div>
        </div>
      </div>
    </div>
  );
}
