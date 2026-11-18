import { ImageResponse } from "next/og";
import { jpegResponse, loadGoogleFont } from "@/lib/og-draw";
import { HEADLINE, VALUE_LINE } from "@/lib/value-line";

// /og/mesita.jpg — Mesita's own link preview (MESITA-4341, Pato: "update
// this too"), the card mesita.ai and every page without its own unfurls
// into: an ink panel with the mark, the cover's headline (Fraunces) and its
// value line (Inter) at the left, the terrace photo at the right
// (MESITA-4361). Words from lib/value-line.ts, so the card never says what
// the cover stopped saying.

export const runtime = "nodejs";

export async function GET(req: Request) {
  const [fraunces, inter, outfit, markSvg] = await Promise.all([
    loadGoogleFont("family=Fraunces:opsz,wght@144,600"),
    loadGoogleFont("family=Inter:wght@500"),
    loadGoogleFont("family=Outfit:wght@700"),
    fetch(new URL("/brand/mark-white.svg", req.url))
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null),
  ]);
  const photo = new URL("/auth/terrace.jpg", req.url).toString();
  const mark = markSvg ? `data:image/svg+xml;base64,${Buffer.from(markSvg).toString("base64")}` : null;

  // THE SPLIT (Pato, 2026-11-18, MESITA-4361: "it must be horizontal
  // division not vertical. text on the left, image at the right"): an ink
  // panel with the words at the left, the terrace photo at the right. The
  // words over the full photo (MESITA-4341, MESITA-4344) read badly in a chat.
  const PANEL = 520;
  const png = new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: "#0b0b0b" }}>
        <div
          style={{
            width: PANEL,
            height: 630,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "52px 48px 44px",
            color: "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {mark ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mark} alt="" width={44} height={44} style={{ width: 44, height: 44 }} />
            ) : null}
            <div
              style={{
                fontFamily: outfit ? "Outfit" : undefined,
                fontSize: 40,
                fontWeight: 700,
                letterSpacing: "-0.03em",
              }}
            >
              Mesita
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontFamily: fraunces ? "Fraunces" : undefined,
                fontSize: 58,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
              }}
            >
              {HEADLINE}
            </div>
            <div
              style={{
                marginTop: 20,
                fontFamily: inter ? "Inter" : undefined,
                fontSize: 24,
                lineHeight: 1.35,
                color: "rgba(255,255,255,0.8)",
              }}
            >
              {VALUE_LINE}
            </div>
          </div>
          <div
            style={{
              fontFamily: inter ? "Inter" : undefined,
              fontSize: 20,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            mesita.ai
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt=""
          width={1200 - PANEL}
          height={630}
          style={{ width: 1200 - PANEL, height: 630, objectFit: "cover", objectPosition: "center 45%" }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        ...(inter ? [{ name: "Inter", data: inter, weight: 500 as const, style: "normal" as const }] : []),
        ...(fraunces ? [{ name: "Fraunces", data: fraunces, weight: 600 as const, style: "normal" as const }] : []),
        ...(outfit ? [{ name: "Outfit", data: outfit, weight: 700 as const, style: "normal" as const }] : []),
      ],
    },
  );
  return (
    (await jpegResponse(png)) ??
    new Response("preview unavailable", { status: 503, headers: { "Cache-Control": "no-store" } })
  );
}
