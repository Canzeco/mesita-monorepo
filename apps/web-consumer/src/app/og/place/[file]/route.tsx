import { ImageResponse } from "next/og";
import { apiFetchPlaceDetail } from "@/lib/api/places";
import { createServerSupabase } from "@/lib/supabase/server";
import { PLACE_PREVIEW_SIZE, placePreviewLine } from "@/lib/place-preview";
import { SHARE_CARD } from "@/lib/share-app";
import { jpegResponse, loadGoogleFont } from "@/lib/og-draw";

// /og/place/<slug>.jpg — a shared place link's card (MESITA-4334, Pato
// picked C): the place's first photo across the top, a white band with the
// name (Fraunces, the app's display face), the line, and the Mesita mark.
// Drawn by next/og (PNG), then sent as JPEG: a photo PNG runs past 300 KB,
// where WhatsApp drops the preview. A place that is gone, or has no photo,
// gets Mesita's own card instead.

export const runtime = "nodejs";

const PHOTO_HEIGHT = 440;

/** The rating's star, drawn: no loaded font has ★ (it drew an empty box). */
function Star() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" style={{ marginRight: 6 }}>
      <path
        fill="#f59e0b"
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
      />
    </svg>
  );
}

function genericCard(req: Request): Response {
  return Response.redirect(new URL(SHARE_CARD.src, req.url), 302);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const slug = decodeURIComponent(file).replace(/\.jpe?g$/i, "");
  if (!slug) return genericCard(req);

  const place = await apiFetchPlaceDetail(await createServerSupabase(), slug).catch(() => null);
  const photo = place?.photos[0] ?? place?.profilePhoto ?? null;
  if (!place || !photo) return genericCard(req);

  const [font, sans, markSvg] = await Promise.all([
    loadGoogleFont("family=Fraunces:opsz,wght@144,600"),
    loadGoogleFont("family=Inter:wght@500"),
    fetch(new URL("/brand/mark-black.svg", req.url))
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null),
  ]);
  const mark = markSvg ? `data:image/svg+xml;base64,${Buffer.from(markSvg).toString("base64")}` : null;
  const line = placePreviewLine(place);
  // A long name steps down so it stays on one line in the band.
  const nameSize = place.name.length > 34 ? 44 : place.name.length > 24 ? 52 : 58;

  const png = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#ffffff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt=""
          width={PLACE_PREVIEW_SIZE.width}
          height={PHOTO_HEIGHT}
          style={{ width: "100%", height: PHOTO_HEIGHT, objectFit: "cover" }}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 56px",
            gap: 32,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: font ? "Fraunces" : undefined,
                fontSize: nameSize,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                color: "#1c1917",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {place.name}
            </div>
            {line ? (
              <div
                style={{
                  marginTop: 18,
                  fontSize: 28,
                  color: "#78716c",
                  display: "flex",
                  alignItems: "center",
                  fontFamily: sans ? "Inter" : undefined,
                }}
              >
                {line.startsWith("★ ") ? (
                  <>
                    <Star />
                    {line.slice(2)}
                  </>
                ) : (
                  line
                )}
              </div>
            ) : null}
          </div>
          {mark ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mark} alt="" width={80} height={80} style={{ width: 80, height: 80 }} />
          ) : null}
        </div>
      </div>
    ),
    {
      ...PLACE_PREVIEW_SIZE,
      emoji: "twemoji",
      fonts: [
        ...(sans ? [{ name: "Inter", data: sans, weight: 500 as const, style: "normal" as const }] : []),
        ...(font ? [{ name: "Fraunces", data: font, weight: 600 as const, style: "normal" as const }] : []),
      ],
    },
  );

  return (await jpegResponse(png)) ?? genericCard(req);
}
