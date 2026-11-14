import { ImageResponse } from "next/og";

// The share card, drawn at build time so it says what the page says. It
// replaced a San Francisco photo when the launch city became Monterrey
// (MESITA-3106).
export const alt = "Mesita — where are we going? Mesita knows.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        color: "white",
        background: "linear-gradient(135deg, #f0518f 0%, #e10069 100%)",
      }}
    >
      <div style={{ fontSize: 44, fontWeight: 700 }}>Mesita</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>
          Where are we going?
        </div>
        <div
          style={{
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
            opacity: 0.85,
          }}
        >
          Mesita knows.
        </div>
      </div>
      <div style={{ fontSize: 30, opacity: 0.9 }}>
        Six products for guests · fourteen for restaurants · launching in Monterrey
      </div>
    </div>,
    size,
  );
}
