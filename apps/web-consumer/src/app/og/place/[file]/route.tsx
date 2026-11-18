import { ImageResponse } from "next/og";
import sharp from "sharp";
import { apiFetchPlaceDetail } from "@/lib/api/places";
import { createServerSupabase } from "@/lib/supabase/server";
import { PLACE_PREVIEW_SIZE, placePreviewLine } from "@/lib/place-preview";
import { SHARE_CARD } from "@/lib/share-app";

// /og/place/<slug>.jpg — a shared place link's card (MESITA-4334, Pato
// picked C): the place's first photo across the top, a white band with the
// name (Fraunces, the app's display face), the line, and the Mesita mark.
// Drawn by next/og (PNG), then sent as JPEG: a photo PNG runs past 300 KB,
// where WhatsApp drops the preview. A place that is gone, or has no photo,
// gets Mesita's own card instead.

export const runtime = "nodejs";

const PHOTO_HEIGHT = 440;
const DAY = 60 * 60 * 24;

// Fraunces 600 as TrueType: Google serves TTF to a client that names no
// browser, which is what Satori reads (never woff2). Kept for the instance.
let fraunces: Promise<ArrayBuffer | null> | null = null;
function loadFraunces(): Promise<ArrayBuffer | null> {
  fraunces ??= (async () => {
    try {
      const css = await fetch(
        "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@144,600&display=swap",
      ).then((r) => r.text());
      const src = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
      if (!src) return null;
      return await fetch(src).then((r) => r.arrayBuffer());
    } catch {
      return null;
    }
  })();
  return fraunces;
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

  const [font, markSvg] = await Promise.all([
    loadFraunces(),
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
              <div style={{ marginTop: 18, fontSize: 28, color: "#78716c", display: "flex" }}>{line}</div>
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
      fonts: font ? [{ name: "Fraunces", data: font, weight: 600, style: "normal" }] : undefined,
    },
  );

  try {
    const jpeg = await sharp(Buffer.from(await png.arrayBuffer()))
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return new Response(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": `public, max-age=${DAY}, s-maxage=${DAY}, stale-while-revalidate=${7 * DAY}`,
      },
    });
  } catch {
    return genericCard(req);
  }
}
