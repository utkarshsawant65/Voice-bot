import { ImageResponse } from "next/og";

export const alt = "Talk to Utkarsh: tap the mic and ask";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Link preview shown when the URL is pasted into email, Slack or LinkedIn
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 70,
          padding: 90,
          background: "radial-gradient(circle at 15% 20%, #2a2f6b, #0b1020 60%)",
        }}
      >
        <div
          style={{
            width: 260,
            height: 260,
            borderRadius: 130,
            background: "#a5b4fc",
            boxShadow: "0 0 90px #6366f1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0b1020",
            fontSize: 44,
            fontWeight: 700,
          }}
        >
          Tap & ask
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 84, fontWeight: 700, color: "#eef0ff" }}>Talk to Utkarsh</div>
          <div style={{ fontSize: 38, color: "#8b93b8", marginTop: 24, lineHeight: 1.3 }}>
            An AI voice version of Utkarsh Sawant. Ask anything about his work and hear him answer.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
