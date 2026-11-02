// Supabase Edge Function — admin-web-update-place
//
// Super-admin only. Updates the editable profile fields of one place, from
// web-admin. The save itself (validation, writes, pins, operator-field marks,
// embedding refresh, ledger row) is `_shared/place-update-apply.ts`, shared
// with business-web-update-place since the profile editor moved to the
// Business app (MESITA-3103). Admin still sends the operator's switches
// (reservations, prepayments) from Single Place › Admin. It does not Sync.
//
// Local:  supabase functions serve admin-web-update-place
// Deploy: supabase functions deploy admin-web-update-place

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { applyPlaceUpdate } from "../_shared/place-update-apply.ts";
import type { UpdateBody } from "../_shared/place-update.ts";

serveJson("admin-web-update-place", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<UpdateBody>(req);
  if (!bodyRes.ok) return bodyRes.response;
  return await applyPlaceUpdate(admin, bodyRes.body, {
    actor: "admin",
    userId: user.id,
    source: "admin-web-update-place",
  });
});
