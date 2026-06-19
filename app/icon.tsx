import { ImageResponse } from "next/og";

export const size        = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 15,
          background: "linear-gradient(160deg, #181818 0%, #080808 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid rgba(181,255,71,0.20)",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(181,255,71,0.4) 0%, rgba(181,255,71,0) 70%)",
            top: 12,
            left: 12,
          }}
        />
        <span style={{ fontSize: 32, lineHeight: 1, color: "#b5ff47", fontWeight: 700 }}>
          ✦
        </span>
      </div>
    ),
    { width: 64, height: 64 },
  );
}
