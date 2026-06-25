import { ImageResponse } from "next/og";
import type { Page } from "@/lib/pages";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "ПроМастер";

export function buildOgImageContent(page: Pick<Page, "service" | "cityPrepositional" | "city" | "description">) {
  const service = page.service || "Услуга";
  const city = page.cityPrepositional || page.city || "";
  const desc = (page.description || "").slice(0, 120);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #1a2b4a 0%, #2a3f6a 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              background: "#f97316",
              borderRadius: 12,
              padding: "12px 24px",
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            ПроМастер
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.15 }}>
            {service} в {city}
          </div>
          <div style={{ fontSize: 28, opacity: 0.85, maxWidth: 900 }}>{desc}</div>
        </div>
        <div style={{ fontSize: 24, opacity: 0.7 }}>master-na-dom.online · Выезд от 30 минут</div>
      </div>
    ),
    { ...size }
  );
}
