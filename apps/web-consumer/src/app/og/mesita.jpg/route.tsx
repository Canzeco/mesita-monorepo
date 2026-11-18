import { ImageResponse } from "next/og";
import { jpegResponse, loadGoogleFont } from "@/lib/og-draw";
import { HEADLINE, VALUE_LINE } from "@/lib/value-line";

// /og/mesita.jpg — Mesita's own link preview (MESITA-4341, Pato: "update
// this too"), the card mesita.ai and every page without its own unfurls
// into. The sign-in cover as a 1200×630 card: the terrace photo full bleed,
// the mark and wordmark top-left, the cover's headline in Fraunces and its
// value line in Inter on the dark foot. Words from lib/value-line.ts, so
// the card never says what the cover stopped saying.

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

  const png = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#000" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt=""
          width={1200}
          height={630}
          style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover", objectPosition: "center 40%" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.88) 100%)",
          }}
        />
        <div style={{ position: "absolute", left: 56, top: 48, display: "flex", alignItems: "center", gap: 14 }}>
          {mark ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mark} alt="" width={52} height={52} style={{ width: 52, height: 52 }} />
          ) : null}
          <div
            style={{
              fontFamily: outfit ? "Outfit" : undefined,
              fontSize: 46,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#fff",
            }}
          >
            Mesita
          </div>
        </div>
        <div style={{ position: "absolute", left: 56, right: 56, bottom: 52, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: fraunces ? "Fraunces" : undefined,
              fontSize: 72,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.04,
              color: "#fff",
            }}
          >
            {HEADLINE}
          </div>
          <div
            style={{
              marginTop: 18,
              fontFamily: inter ? "Inter" : undefined,
              fontSize: 30,
              lineHeight: 1.3,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {VALUE_LINE}
          </div>
        </div>
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
