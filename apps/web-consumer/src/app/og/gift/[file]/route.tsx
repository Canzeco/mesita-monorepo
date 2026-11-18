import { ImageResponse } from "next/og";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import { apiGetGiftPreview } from "@/lib/api/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { jpegResponse, loadGoogleFont } from "@/lib/og-draw";
import { SHARE_CARD } from "@/lib/share-app";

// /og/gift/<token>.jpg — a gift link's card (Pato, 2026-11-18, MESITA-4363:
// "the image must be the actual gift card and place … profile and place and
// credits and gift box"; "Yes, show sender"). The Mesita card's split: an
// ink panel at the left with a gift-box mark, the amount, the place, and
// the sender's photo and first name; the place's photo at the right. A link
// that is taken, gone or has no photo gets the Mesita card. Drawn here, not
// by an outside image service: nothing about the gift leaves Mesita.

export const runtime = "nodejs";

const W = 1200;
const H = 630;
const PANEL = 560;

/** The gift box, drawn: a font glyph would need an emoji font. */
function GiftBox() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}

function mesitaCard(req: Request): Response {
  return Response.redirect(new URL(SHARE_CARD.src, req.url), 302);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const token = decodeURIComponent(file).replace(/\.jpe?g$/i, "");
  if (!token) return mesitaCard(req);

  const gift = await apiGetGiftPreview(await createServerSupabase(), token, 4000).catch(() => null);
  if (!gift || !gift.placePhoto) return mesitaCard(req);

  const [fraunces, inter] = await Promise.all([
    loadGoogleFont("family=Fraunces:opsz,wght@144,600"),
    loadGoogleFont("family=Inter:wght@500"),
  ]);
  const amount = moneyLabel(gift.amount_cents, gift.currency);
  const sender = gift.senderName ?? "a friend";
  const nameSize = (gift.placeName?.length ?? 0) > 26 ? 34 : 40;

  const png = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", background: "#0b0b0b" }}>
        <div
          style={{
            width: PANEL,
            height: H,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "52px 48px 48px",
            color: "#fff",
            fontFamily: inter ? "Inter" : undefined,
          }}
        >
          <GiftBox />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 26, color: "rgba(255,255,255,0.7)" }}>Gift card</div>
            <div
              style={{
                marginTop: 6,
                fontFamily: fraunces ? "Fraunces" : undefined,
                fontSize: 84,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {amount}
            </div>
            {gift.placeName ? (
              <div style={{ marginTop: 16, fontSize: nameSize, lineHeight: 1.15, display: "flex" }}>
                at {gift.placeName}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {gift.senderPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={gift.senderPhoto}
                alt=""
                width={56}
                height={56}
                style={{ width: 56, height: 56, borderRadius: 28, objectFit: "cover", border: "2px solid rgba(255,255,255,0.85)" }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                }}
              >
                {sender.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 26 }}>From {sender}</div>
              <div style={{ fontSize: 20, color: "rgba(255,255,255,0.6)" }}>on Mesita</div>
            </div>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gift.placePhoto}
          alt=""
          width={W - PANEL}
          height={H}
          style={{ width: W - PANEL, height: H, objectFit: "cover" }}
        />
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        ...(inter ? [{ name: "Inter", data: inter, weight: 500 as const, style: "normal" as const }] : []),
        ...(fraunces ? [{ name: "Fraunces", data: fraunces, weight: 600 as const, style: "normal" as const }] : []),
      ],
    },
  );
  const jpeg = await jpegResponse(png);
  if (!jpeg) return mesitaCard(req);
  // A gift changes when someone takes it: a short cache, not a day.
  jpeg.headers.set("Cache-Control", "public, max-age=300, s-maxage=300");
  return jpeg;
}
