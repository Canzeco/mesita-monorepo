// Supabase Edge Function — business-web-set-waiter
//
// MESITA-4871: the waiters of a place, one 8-digit code each, so a bill and
// its tip have a name. Mesita makes the code (an owner-typed one would read
// "taken" and reveal another place's), matched by a keyed hash, and kept for the
// owner's screen (MESITA-4886). The owner and Mesita staff only.
//
// Body: { place_id, action: "add", name }
//     | { place_id, action: "codes_off" | "codes_on" }  (MESITA-4890: bills with no
//       code, Discount only; saving Cashback turns codes on again)
//     | { place_id, action: "new_code" | "remove", waiter_id }
// Response: { ok: true, waiter_id, name, code?: "12345678" }
//   400 bad_request · 403 · 404 gone · 409 name_taken | too_many | cashback

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { lookupWaiterCode, mintWaiterCode, readWaiterName, WAITER_NAME_MAX, WAITERS_MAX } from "../_shared/waiter-code.ts";

serveJson("business-web-set-waiter", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, action, waiter_id: waiterId } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (action !== "add" && action !== "new_code" && action !== "remove" && action !== "codes_off" && action !== "codes_on") return json({ ok: false, error: "Unknown action" }, 400);
  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  const stamp = { updated_at: new Date().toISOString(), updated_by: user.id };
  const gone = () => json({ ok: false, code: "gone", error: "This waiter is gone. Reload the page." }, 404);

  if (action === "codes_on") {
    const { error } = await admin.from("place_waiters")
      .update({ ...stamp, lookup_hash: null, code: null, removed_at: stamp.updated_at })
      .eq("place_id", placeId).eq("no_code", true).is("removed_at", null);
    if (error) return json({ ok: false, error: `place_waiters: ${error.message}` }, 500);
    return json({ ok: true, waiter_id: "", name: "" });
  }
  if (action === "codes_off") {
    const mech = await admin.rpc("place_visit_mechanism", { p_place_id: placeId });
    if (mech.error) return json({ ok: false, error: `place_visit_mechanism: ${mech.error.message}` }, 500);
    if (mech.data !== "discount") {
      return json({ ok: false, code: "cashback", error: "Cashback needs waiter codes. Save Discount first." }, 409);
    }
    // A key nobody can type: 32 random bytes.
    const lookup_hash = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await admin.from("place_waiters").insert({ place_id: placeId, name: "(no code)", no_code: true, lookup_hash, ...stamp });
    // Already off: the same answer.
    if (error && error.code !== "23505") return json({ ok: false, error: `place_waiters: ${error.message}` }, 500);
    return json({ ok: true, waiter_id: "", name: "" });
  }

  if (action === "remove") {
    if (!isUuid(waiterId)) return gone();
    const { data, error } = await admin.from("place_waiters")
      .update({ ...stamp, lookup_hash: null, code: null, removed_at: stamp.updated_at })
      .eq("id", waiterId).eq("place_id", placeId).eq("no_code", false).is("removed_at", null).select("id, name").maybeSingle();
    if (error) return json({ ok: false, error: `place_waiters: ${error.message}` }, 500);
    return data ? json({ ok: true, waiter_id: data.id, name: data.name }) : gone();
  }

  const name = action === "add" ? readWaiterName(bodyRes.body.name) : null;
  if (action === "add") {
    if (!name) return json({ ok: false, code: "bad_request", error: `Type the waiter's name, up to ${WAITER_NAME_MAX} characters.` }, 400);
    const { count, error } = await admin.from("place_waiters").select("id", { count: "exact", head: true }).eq("place_id", placeId).is("removed_at", null);
    if (error) return json({ ok: false, error: `place_waiters: ${error.message}` }, 500);
    if ((count ?? 0) >= WAITERS_MAX) return json({ ok: false, code: "too_many", error: `A place has up to ${WAITERS_MAX} waiters.` }, 409);
  } else if (!isUuid(waiterId)) return gone();

  // A code is one waiter's: a collision draws again.
  for (let i = 0; i < 5; i++) {
    const code = mintWaiterCode();
    const lookup_hash = await lookupWaiterCode(env.serviceKey, code);
    const q = action === "add"
      ? admin.from("place_waiters").insert({ place_id: placeId, name, lookup_hash, code, ...stamp })
      : admin.from("place_waiters").update({ lookup_hash, code, ...stamp }).eq("id", waiterId).eq("place_id", placeId).eq("no_code", false).is("removed_at", null);
    const { data, error } = await q.select("id, name").maybeSingle();
    if (!error) return data ? json({ ok: true, waiter_id: data.id, name: data.name, code }) : gone();
    if (error.code !== "23505") return json({ ok: false, error: `place_waiters: ${error.message}` }, 500);
    if (error.message.includes("place_waiters_name")) {
      return json({ ok: false, code: "name_taken", error: `${name} already has a code here.` }, 409);
    }
  }
  return json({ ok: false, error: "Couldn't make a code. Try again." }, 500);
});
