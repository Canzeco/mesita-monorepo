// Supabase Edge Function — business-web-check-place-code
//
// MESITA-3127. The 6-digit code the claim call said. Right → the code is
// spent and place_verification_approve writes the guest in (method
// 'phone_code', owner while the seat is free, else editor). Wrong → one of
// five tries is used (counted in the DB, so parallel guesses each pay). A
// code lives 10 minutes.
//
// Body: { place_id: uuid, code: "123456" }
// Response: { ok: true, outcome: "verified" }
//         | { ok: false, code: "wrong_code", tries_left, error } | { ok: false, code: "expired" | "invalid", error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { VERIFICATION_DAYS } from "../_shared/place-verification.ts";
import { timingSafeEqual } from "../_shared/timing-safe-equal.ts";
import { CODE_TRIES, hashCode } from "../_shared/place-call-code.ts";

const EXPIRED = { ok: false, code: "expired", error: "This code ended. Call the place again for a new one." };

serveJson("business-web-check-place-code", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, code } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, code: "invalid", error: "place_id must be a Mesita place id" }, 400);
  if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
    return json({ ok: false, code: "invalid", error: "The code is six digits" }, 400);
  }

  // One try is spent before the compare (place_take_code_try), so parallel
  // guesses each pay; null = no live code or no tries left.
  const { data: hash, error: tryErr } = await admin.rpc("place_take_code_try", {
    p_place_id: placeId,
    p_consumer_id: user.id,
    p_max: CODE_TRIES,
  });
  if (tryErr) return json({ ok: false, error: tryErr.message }, 500);
  if (typeof hash !== "string") return json(EXPIRED, 410);

  if (!timingSafeEqual(await hashCode(placeId, user.id, code.trim()), hash)) {
    const { data: left } = await admin.from("place_verification_codes").select("attempts")
      .eq("place_id", placeId).eq("consumer_id", user.id).maybeSingle();
    const triesLeft = Math.max(0, CODE_TRIES - (left?.attempts ?? CODE_TRIES));
    if (triesLeft === 0) return json(EXPIRED, 410);
    const tries = triesLeft === 1 ? "1 try left" : `${triesLeft} tries left`;
    return json({ ok: false, code: "wrong_code", tries_left: triesLeft, error: `That's not the code the call said. ${tries}.` }, 400);
  }

  // Spend the code first: only one request can delete the row.
  const { data: spent, error: delErr } = await admin.from("place_verification_codes").delete()
    .eq("place_id", placeId).eq("consumer_id", user.id).eq("code_hash", hash).select("place_id");
  if (delErr) return json({ ok: false, error: delErr.message }, 500);
  if (!spent || spent.length === 0) return json(EXPIRED, 410);

  const { error } = await admin.rpc("place_verification_approve", {
    p_place_id: placeId,
    p_consumer_id: user.id,
    p_method: "phone_code",
    p_days: VERIFICATION_DAYS,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  console.log(JSON.stringify({ fn: "business-web-check-place-code", place_id: placeId, outcome: "verified" }));
  return json({ ok: true, outcome: "verified" });
});
