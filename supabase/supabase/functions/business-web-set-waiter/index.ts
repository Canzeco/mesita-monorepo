// Supabase Edge Function — business-web-set-waiter
//
// MESITA-4904: a place's one 6-digit code, and whether the waiter types their name
// before it. Mesita makes the code and keeps it for the owner's screen
// (MESITA-4886). The owner and Mesita staff only.
//
// Body: { place_id, action: "new_code" | "name_on" | "name_off" }
// Response: { ok: true, code?: "123456" }
//   400 bad_request · 403 · 404 gone

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { mintWaiterCode, mintWaiterKey } from "../_shared/waiter-code.ts";

serveJson("business-web-set-waiter", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, action } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (typeof action !== "string" || !["new_code", "name_on", "name_off"].includes(action)) return json({ ok: false, error: "Unknown action" }, 400);
  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  const stamp = { updated_at: new Date().toISOString(), updated_by: user.id };

  if (action === "name_on" || action === "name_off") {
    const { data, error } = await admin.from("place_waiters").update({ ...stamp, name_required: action === "name_on" })
      .eq("place_id", placeId).is("removed_at", null).select("id").maybeSingle();
    if (error) return json({ ok: false, error: `place_waiters: ${error.message}` }, 500);
    return data ? json({ ok: true }) : json({ ok: false, code: "gone", error: "Make a code first." }, 404);
  }

  // The place's one code: a new one ends the last, and every phone signed in with it.
  const row = { lookup_hash: mintWaiterKey(), code: mintWaiterCode(), ...stamp };
  const changed = await admin.from("place_waiters").update(row)
    .eq("place_id", placeId).is("removed_at", null).select("code").maybeSingle();
  if (changed.error) return json({ ok: false, error: `place_waiters: ${changed.error.message}` }, 500);
  if (!changed.data) {
    const { error } = await admin.from("place_waiters").insert({ place_id: placeId, name: "Staff", ...row });
    if (error) return json({ ok: false, error: `place_waiters: ${error.message}` }, 500);
  }
  return json({ ok: true, code: row.code });
});
