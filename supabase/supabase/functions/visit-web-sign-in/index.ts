// Supabase Edge Function — visit-web-sign-in
//
// MESITA-4827: the waiter types the place's 6-digit code on a bill. The code
// alone names the place (place_codes.lookup_hash); no phone is set up and
// nothing about it is remembered. Answers a staff token of that place, which
// the bill's own calls carry.
//
// Body: { code: 6 digits }
// Response: { ok: true, place: { id, name }, staff_token }
//   400 bad_request · 403 staff_only (a wrong code: one try of this address) ·
//   409 locked (+retry_after_s; five wrong codes in ten minutes)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { clientAddress, lockedFor, PAIR_TRY_LIMIT, staffTryKey, TRY_WINDOW_SEC } from "../_shared/charge.ts";
import { lookupPlaceCode, readPlaceCode } from "../_shared/place-code.ts";
import { mintStaffToken, supabaseStaffStore } from "../_shared/staff.ts";

serveJson("visit-web-sign-in", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const code = readPlaceCode(bodyRes.body.code);
  if (!code) return json({ ok: false, code: "bad_request", error: "Type the 6-digit code" }, 400);

  try {
    const nowMs = Date.now();
    const addr = await staffTryKey(env.serviceKey, clientAddress(req.headers));
    const tries = await admin.from("place_charge_tries").select("tried_at")
      .is("place_id", null).eq("kind", "staff").eq("addr_hash", addr)
      .gte("tried_at", new Date(nowMs - TRY_WINDOW_SEC * 1000).toISOString())
      .order("tried_at", { ascending: false }).limit(PAIR_TRY_LIMIT);
    if (tries.error) throw new Error(`staff_tries: ${tries.error.message}`);
    const wait = lockedFor((tries.data as Array<{ tried_at: string }>).map((t) => t.tried_at), PAIR_TRY_LIMIT, nowMs);
    if (wait > 0) return json({ ok: false, code: "locked", error: "Too many wrong codes. Wait a few minutes.", retry_after_s: wait }, 409);

    const found = await admin.from("place_codes").select("place_id").eq("lookup_hash", await lookupPlaceCode(env.serviceKey, code)).maybeSingle();
    if (found.error) throw new Error(`place_codes: ${found.error.message}`);
    const placeId = (found.data as { place_id: string } | null)?.place_id ?? null;
    const placeRes = placeId ? await readVoucherPlace(admin, placeId) : null;
    if (placeRes && !placeRes.ok) throw new Error(placeRes.error);
    const place = placeRes?.place ?? null;
    const keys = placeId ? await supabaseStaffStore(admin).keys(placeId) : null;
    if (!placeId || !keys || !place || place.state !== "active") {
      const t = await admin.from("place_charge_tries").insert({ place_id: null, kind: "staff", addr_hash: addr });
      if (t.error) throw new Error(`staff_try_write: ${t.error.message}`);
      console.log("[visit-web-sign-in]", JSON.stringify({ outcome: "staff_only" }));
      return json({ ok: false, code: "staff_only", error: "That code is not right" }, 403);
    }
    const minted = await mintStaffToken(env.serviceKey, placeId, keys, nowMs, "code");
    console.log("[visit-web-sign-in]", JSON.stringify({ outcome: "ok", place_id: placeId }));
    return json({ ok: true, place: { id: placeId, name: place.name ?? null }, staff_token: minted.token });
  } catch (err) {
    return failWithRequestId("visit-web-sign-in", "Couldn't check the code. Try again.", err);
  }
});
