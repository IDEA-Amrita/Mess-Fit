import { ImageResponse } from "next/og";

// iOS apple-touch-icon (PNG, rendered at build) — Next auto-injects the <link>.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0b0e",
        }}
      >
        <div
          style={{
            width: 108,
            height: 108,
            borderRadius: "9999px",
            border: "8px solid #f59e0b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: "9999px",
              background: "#f59e0b",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
