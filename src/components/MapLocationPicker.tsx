import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

type PickMode = "pickup" | "destination";

type MapLocationPickerProps = {
  pickupText: string;
  destinationText: string;
  onPickupChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
};

type ReverseGeocodeResult = {
  display_name?: string;
};

type NominatimSearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
};

type PickedAddress = {
  coordinates: string;
  label: string;
};

const nominatimBaseUrl =
  (import.meta.env.VITE_NOMINATIM_BASE_URL as string | undefined) ||
  "https://nominatim.openstreetmap.org";

function parseCoordinates(value: string) {
  const parts = value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part));

  if (parts.length !== 2) return null;

  const [lat, lng] = parts;

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return { lat, lng };
}

function formatCoordinates(lat: number, lng: number) {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function shortAddress(value: string) {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.slice(0, 4).join(", ") || value;
}

async function reverseGeocode(lat: number, lng: number, signal: AbortSignal) {
  const url = `${nominatimBaseUrl}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

  const response = await fetch(url, {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed: ${response.status}`);
  }

  const json = (await response.json()) as ReverseGeocodeResult;
  return json.display_name ? shortAddress(json.display_name) : null;
}

async function searchNominatim(query: string, signal: AbortSignal) {
  const url = `${nominatimBaseUrl}/search?format=jsonv2&q=${encodeURIComponent(
    query
  )}&limit=5&addressdetails=1`;

  const response = await fetch(url, {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Location search failed: ${response.status}`);
  }

  return (await response.json()) as NominatimSearchResult[];
}

function markerIcon(label: string, background: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 30px;
        height: 30px;
        border-radius: 999px;
        background: ${background};
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        border: 3px solid white;
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.25);
      ">
        ${label}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function pickerButtonStyle(active: boolean): React.CSSProperties {
  return {
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "9px 12px",
    background: active ? "#111827" : "#ffffff",
    color: active ? "#ffffff" : "#111827",
    fontWeight: 800,
    cursor: "pointer",
  };
}

function smallActionButtonStyle(background: string): React.CSSProperties {
  return {
    border: 0,
    borderRadius: 999,
    padding: "8px 10px",
    background,
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 12,
  };
}

function addressBoxStyle(): React.CSSProperties {
  return {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.6,
  };
}

export default function MapLocationPicker({
  pickupText,
  destinationText,
  onPickupChange,
  onDestinationChange,
}: MapLocationPickerProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);

  const [pickMode, setPickMode] = useState<PickMode>("pickup");
  const pickModeRef = useRef<PickMode>("pickup");

  const reverseControllersRef = useRef<Record<PickMode, AbortController | null>>({
    pickup: null,
    destination: null,
  });

  const searchControllerRef = useRef<AbortController | null>(null);

  const [pickupAddress, setPickupAddress] = useState<PickedAddress | null>(null);
  const [destinationAddress, setDestinationAddress] =
    useState<PickedAddress | null>(null);

  const [reverseLoading, setReverseLoading] = useState<PickMode | null>(null);
  const [reverseMessage, setReverseMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");

  const pickupPoint = useMemo(() => parseCoordinates(pickupText), [pickupText]);
  const destinationPoint = useMemo(
    () => parseCoordinates(destinationText),
    [destinationText]
  );

  useEffect(() => {
    pickModeRef.current = pickMode;
  }, [pickMode]);

  function moveMapTo(lat: number, lng: number, zoom = 14) {
    const map = mapRef.current;

    if (!map) return;

    map.setView([lat, lng], zoom);
  }

  function setPickedLocation(
    mode: PickMode,
    lat: number,
    lng: number,
    label: string
  ) {
    const coordinates = formatCoordinates(lat, lng);

    if (mode === "pickup") {
      onPickupChange(coordinates);
      setPickupAddress({ coordinates, label });
      setPickMode("destination");
    } else {
      onDestinationChange(coordinates);
      setDestinationAddress({ coordinates, label });
    }

    moveMapTo(lat, lng, 14);
  }

  async function handleMapPick(lat: number, lng: number, mode: PickMode) {
    const coordinates = formatCoordinates(lat, lng);

    if (mode === "pickup") {
      onPickupChange(coordinates);
      setPickupAddress({ coordinates, label: "Looking up pickup address..." });
      setPickMode("destination");
    } else {
      onDestinationChange(coordinates);
      setDestinationAddress({
        coordinates,
        label: "Looking up destination address...",
      });
    }

    setReverseLoading(mode);
    setReverseMessage("");

    reverseControllersRef.current[mode]?.abort();

    const controller = new AbortController();
    reverseControllersRef.current[mode] = controller;

    try {
      const label = await reverseGeocode(lat, lng, controller.signal);

      if (mode === "pickup") {
        setPickupAddress({
          coordinates,
          label: label ?? "Pickup address not available",
        });
      } else {
        setDestinationAddress({
          coordinates,
          label: label ?? "Destination address not available",
        });
      }
    } catch (error) {
      if (controller.signal.aborted) return;

      console.warn("Reverse geocoding fallback:", error);
      setReverseMessage(
        "Address lookup is unavailable now. Coordinates were saved successfully."
      );

      if (mode === "pickup") {
        setPickupAddress({ coordinates, label: "Pickup coordinates saved" });
      } else {
        setDestinationAddress({
          coordinates,
          label: "Destination coordinates saved",
        });
      }
    } finally {
      if (reverseControllersRef.current[mode] === controller) {
        reverseControllersRef.current[mode] = null;
      }

      setReverseLoading((current) => (current === mode ? null : current));
    }
  }

  async function handleSearch() {
    const query = searchQuery.trim();

    if (!query) {
      setSearchMessage("Please enter a place name to search.");
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setSearchMessage("");
    setSearchResults([]);

    searchControllerRef.current?.abort();
    const controller = new AbortController();
    searchControllerRef.current = controller;

    try {
      const results = await searchNominatim(query, controller.signal);
      setSearchResults(results);

      if (results.length === 0) {
        setSearchMessage("No matching locations found.");
      }
    } catch (error) {
      if (controller.signal.aborted) return;

      console.warn("Location search fallback:", error);
      setSearchMessage("Location search is unavailable now. You can still click on the map.");
    } finally {
      if (searchControllerRef.current === controller) {
        searchControllerRef.current = null;
      }

      setSearchLoading(false);
    }
  }

  function handleUseSearchResult(result: NominatimSearchResult, mode: PickMode) {
    const lat = Number(result.lat);
    const lng = Number(result.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setSearchMessage("Selected result has invalid coordinates.");
      return;
    }

    setPickedLocation(mode, lat, lng, shortAddress(result.display_name));
  }

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    const map = L.map(mapNodeRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    }).setView([30.0444, 31.2357], 11);

    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (event: L.LeafletMouseEvent) => {
      void handleMapPick(
        event.latlng.lat,
        event.latlng.lng,
        pickModeRef.current
      );
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      reverseControllersRef.current.pickup?.abort();
      reverseControllersRef.current.destination?.abort();
      searchControllerRef.current?.abort();

      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) return;

    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
      pickupMarkerRef.current = null;
    }

    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
    }

    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    const routePoints: L.LatLng[] = [];

    if (pickupPoint) {
      const pickupLatLng = L.latLng(pickupPoint.lat, pickupPoint.lng);
      routePoints.push(pickupLatLng);

      pickupMarkerRef.current = L.marker(pickupLatLng, {
        icon: markerIcon("P", "#0ea5e9"),
      })
        .addTo(map)
        .bindPopup(pickupAddress?.label || "Pickup");
    }

    if (destinationPoint) {
      const destinationLatLng = L.latLng(
        destinationPoint.lat,
        destinationPoint.lng
      );
      routePoints.push(destinationLatLng);

      destinationMarkerRef.current = L.marker(destinationLatLng, {
        icon: markerIcon("D", "#16a34a"),
      })
        .addTo(map)
        .bindPopup(destinationAddress?.label || "Destination");
    }

    if (routePoints.length === 2) {
      routeLineRef.current = L.polyline(routePoints, {
        color: "#111827",
        weight: 4,
        opacity: 0.75,
        dashArray: "8 8",
      }).addTo(map);

      map.fitBounds(L.latLngBounds(routePoints).pad(0.35));
    } else if (routePoints.length === 1) {
      map.setView(routePoints[0], 13);
    }
  }, [destinationAddress?.label, destinationPoint, pickupAddress?.label, pickupPoint]);

  return (
    <div
      style={{
        marginTop: 14,
        marginBottom: 14,
        padding: 12,
        borderRadius: 16,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <div>
          <strong>Pick locations on map</strong>
          <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
            Search for a place or click the map. Coordinates are saved for routing,
            while the address preview is shown below.
          </div>
        </div>

        <span
          style={{
            borderRadius: 999,
            padding: "6px 10px",
            background: "#ecfdf5",
            color: "#047857",
            fontWeight: 800,
            fontSize: 12,
          }}
        >
          OSM + Nominatim
        </span>
      </div>

      <div
        style={{
          marginBottom: 12,
          padding: 12,
          borderRadius: 14,
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
        }}
      >
        <label
          htmlFor="location-search"
          style={{
            display: "block",
            fontWeight: 800,
            color: "#334155",
            marginBottom: 8,
          }}
        >
          Search location
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            id="location-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSearch();
              }
            }}
            placeholder="Example: Cairo Airport, Giza, Sudan Club..."
            style={{
              flex: "1 1 220px",
              minWidth: 0,
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              padding: "10px 12px",
              font: "inherit",
            }}
          />

          <button
            type="button"
            onClick={() => {
              void handleSearch();
            }}
            disabled={searchLoading}
            style={smallActionButtonStyle("#111827")}
          >
            {searchLoading ? "Searching..." : "Search"}
          </button>
        </div>

        {searchMessage ? (
          <div
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 12,
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {searchMessage}
          </div>
        ) : null}

        {searchResults.length > 0 ? (
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {searchResults.map((result) => (
              <div
                key={result.place_id}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ color: "#334155", fontSize: 13, lineHeight: 1.5 }}>
                  {shortAddress(result.display_name)}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleUseSearchResult(result, "pickup")}
                    style={smallActionButtonStyle("#0ea5e9")}
                  >
                    Use as Pickup
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUseSearchResult(result, "destination")}
                    style={smallActionButtonStyle("#16a34a")}
                  >
                    Use as Destination
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => setPickMode("pickup")}
          style={pickerButtonStyle(pickMode === "pickup")}
        >
          Pick Pickup
        </button>

        <button
          type="button"
          onClick={() => setPickMode("destination")}
          style={pickerButtonStyle(pickMode === "destination")}
        >
          Pick Destination
        </button>
      </div>

      <div
        ref={mapNodeRef}
        style={{
          height: 300,
          width: "100%",
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid #cbd5e1",
        }}
      />

      <div style={addressBoxStyle()}>
        <strong>Current mode:</strong>{" "}
        {pickMode === "pickup" ? "Pick Pickup" : "Pick Destination"}
        {reverseLoading ? ` · Looking up ${reverseLoading} address...` : ""}
      </div>

      {pickupAddress ? (
        <div style={addressBoxStyle()}>
          <strong>Pickup preview:</strong> {pickupAddress.label}
          <div style={{ color: "#64748b" }}>{pickupAddress.coordinates}</div>
        </div>
      ) : null}

      {destinationAddress ? (
        <div style={addressBoxStyle()}>
          <strong>Destination preview:</strong> {destinationAddress.label}
          <div style={{ color: "#64748b" }}>
            {destinationAddress.coordinates}
          </div>
        </div>
      ) : null}

      {reverseMessage ? (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 12,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {reverseMessage}
        </div>
      ) : null}
    </div>
  );
}
