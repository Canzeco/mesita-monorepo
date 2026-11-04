// Supabase Edge Function — business-web-set-place-reward
//
// MESITA-3202: Business › Rewards, one switch: a reward or the Cap, on or off.
// The owner and Mesita staff only: it is the place's money.
//
// Body: { place_id: uuid, key: welcome_visit|returning_visit|instagram_story|vip_class|cap,
//         enabled: boolean }
// Response: { ok: true, rewards: [{ kind, percent, enabled }], cap: { cents, enabled } }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { isRewardKind } from "../_shared/place-visits.ts";

serveJson("business-web-set-place-reward", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, key, enabled } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (key !== "cap" && !isRewardKind(key)) return json({ ok: false, code: "invalid", error: "Unknown reward" }, 400);
  if (typeof enabled !== "boolean") return json({ ok: false, code: "invalid", error: "enabled must be true or false" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  // Only this switch is named, so the others keep what they were.
  const { error } = await admin.from("place_rewards").upsert({
    place_id: placeId,
    [key]: enabled,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (error) return json({ ok: false, error: `place_rewards: ${error.message}` }, 500);

  const { data, error: readErr } = await admin.rpc("place_rewards_read", { p_place_id: placeId });
  if (readErr) return json({ ok: false, error: readErr.message }, 500);
  return json({ ok: true, rewards: data.rewards, cap: data.cap });
});
