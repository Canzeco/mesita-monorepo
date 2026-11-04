// Supabase Edge Function — business-web-get-place-rewards
//
// MESITA-3202: Business › Rewards. Which rewards this place has on and whether
// the Cap applies. The percents and the cap's amount are the server's, fixed in
// SQL (place_reward_catalog) for the moment.
//
// Body: { place_id: uuid }
// Response: { ok: true, can_edit: boolean,
//             rewards: [{ kind, percent, enabled }],
//             cap: { cents, enabled },
//             code_set: boolean }   whether the place code is set, never the code

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { canManage, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("business-web-get-place-rewards", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  const { data, error } = await admin.rpc("place_rewards_read", { p_place_id: placeId });
  if (error) return json({ ok: false, error: error.message }, 500);
  const { data: row, error: rowErr } = await admin.from("place_rewards").select("place_code_hash")
    .eq("place_id", placeId).maybeSingle();
  if (rowErr) return json({ ok: false, error: `place_rewards: ${rowErr.message}` }, 500);
  return json({
    ok: true,
    can_edit: canManage(access.role),
    rewards: data.rewards,
    cap: data.cap,
    code_set: !!row?.place_code_hash,
  });
});
