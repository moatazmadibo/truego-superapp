export default function RiderHome() {
  return (
    <div style={{ padding: 20 }}>
      <h2>TrueGo Rider</h2>

      <div style={{ marginTop: 20 }}>
        <input
          placeholder="Pickup location"
          style={{ padding: 10, width: "100%", marginBottom: 10 }}
        />

        <input
          placeholder="Where to?"
          style={{ padding: 10, width: "100%", marginBottom: 10 }}
        />

        <button
          style={{
            padding: 12,
            width: "100%",
            background: "#0ea5e9",
            color: "white",
            border: "none",
            borderRadius: 8
          }}
        >
          Find Ride
        </button>
      </div>
    </div>
  );
}