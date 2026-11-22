// Supabase Edge Function — consumer-web-get-gift-preview
//
// MESITA-4229: a friend's gift link, before sign-in. A signed-out friend who
// taps <origin>/wallet/gift/<token> lands on sign-in with `?next=`; this
// read lets that page and its link card say "$200.00MX of credit at
// Orinoco. Sign in to take it." Public (no session yet) and narrow: an open
// or claimed link of this payments mode answers with its state, amount,
// currency, place and sender (MESITA-4367: a claimed link's card says
// "Claimed"); anything else (unknown, taken back, the other mode) is one 404
// `gone`. Never the recipient or an id. The place name is
// read with the anon client, like consumer-web-get-pay-place-name, so a
// place the public catalog hides answers place: null.
//
// Body: { token: string }
// Response: { ok: true, gift: { status: "open" | "claimed", amount_cents, currency,
//             place: { name, photo } | null, sender: { firstName, photo } | null } }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { anonClient } from "../_shared/auth.ts";
import { GIFT_MISS_CAP, giftGuardMiss, giftGuardOpen, giftPreview, type GiftRow, hashGiftToken, isGiftToken } from "../_shared/gift.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

/** A link's answer changes when someone takes it: never cache it. */
function noStore(res: Response): Response {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

serveJson("consumer-web-get-gift-preview", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const token = bodyRes.body.token;
  if (!isGiftToken(token)) return json({ ok: false, error: "token must be a credit link's key" }, 400);

  // A 6-character key can be guessed (MESITA-4390): past GIFT_MISS_CAP.preview
  // wrong keys in an hour, the preview answers nothing for anyone (a link
  // then unfurls as the Mesita card; taking it still works signed in).
  const gone = () => noStore(json({ ok: false, code: "gone", error: "That link isn't here." }, 404));
  if (!(await giftGuardOpen(admin, "preview", GIFT_MISS_CAP.preview))) return gone();

  const { data, error } = await admin
    .from("wallet_gifts")
    .select("place_id, amount_cents, currency, status, livemode, sender_id")
    .eq("token_hash", await hashGiftToken(token))
    .maybeSingle();
  if (error) return json({ ok: false, error: `gift: ${error.message}` }, 500);

  const row = data as GiftRow | null;
  if (!row) await giftGuardMiss(admin, "preview");
  const preview = giftPreview(row, paymentsLivemode());
  if (!row || !preview) return gone();

  // The place and the sender are niceties: a failed read still answers,
  // without them. THE LINK'S CARD (Pato, 2026-11-18, MESITA-4363: "the
  // image must be the actual gift card and place"; "Yes, show sender"): the
  // place's first photo and the sender's first name and photo, so the chat
  // preview can draw the gift. Every profile is public (MESITA-4690), so the
  // photo shows to anyone with the link; the first name is what the gift
  // itself already says.
  const [{ data: place, error: placeError }, sender] = await Promise.all([
    anonClient(env).from("profiles").select("name, photos, profile_photo").eq("id", row.place_id).maybeSingle(),
    row.sender_id
      ? admin
        .from("consumers")
        .select("first_name, avatar_url, deleted_at")
        .eq("id", row.sender_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (placeError) console.error("[consumer-web-get-gift-preview] place:", placeError.message);
  if (sender.error) console.error("[consumer-web-get-gift-preview] sender:", sender.error.message);
  const p = place as { name?: unknown; photos?: unknown; profile_photo?: unknown } | null;
  const name = typeof p?.name === "string" && p.name.trim() ? p.name.trim() : null;
  const firstPhoto = Array.isArray(p?.photos) ? p.photos.find((x) => typeof x === "string" && x.startsWith("https://")) : null;
  const photo = (typeof firstPhoto === "string" ? firstPhoto : null) ??
    (typeof p?.profile_photo === "string" && p.profile_photo.startsWith("https://") ? p.profile_photo : null);
  const c = sender.data as
    | { first_name?: string | null; avatar_url?: string | null; deleted_at?: string | null }
    | null;
  const senderName = c && !c.deleted_at && c.first_name?.trim() ? c.first_name.trim() : null;
  const senderPhoto = senderName && c?.avatar_url?.startsWith("https://") ? c.avatar_url : null;

  return noStore(json({
    ok: true,
    gift: {
      ...preview,
      place: name ? { name, photo } : null,
      sender: senderName ? { firstName: senderName, photo: senderPhoto } : null,
    },
  }));
});
