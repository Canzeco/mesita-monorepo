// Supabase Edge Function — admin-web-grant-place-premier
//
// MESITA-2995: Single Place › Premier, the operator's writes.
//   grant         a period with no payer and nothing charged (tier 1..2,
//                 1..12 months); refused while a period is running.
//   end           ends the running grant now; the line pays at the next run.
//   remove_pledge takes one pledge out of the line (its card detached); a
//                 payer's paid period runs out. Never refunds.
//
// Body:     { placeId | projectId, action: "grant", tier: 1|2, months?: 1..12 }
//         | { placeId | projectId, action: "end" }
//         | { placeId | projectId, action: "remove_pledge", backingId: uuid }
// Response: { ok: true }
// Auth:     caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, readPlaceIdAlias, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { boostStripeKey, leavePledge, readPledge, stripeClient } from "../_shared/boost.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("admin-web-grant-place-premier", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  const placeId = readPlaceIdAlias(body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  if (body.action === "grant") {
    const tier = Number(body.tier);
    const months = body.months == null ? 1 : Number(body.months);
    if (![1, 2].includes(tier)) {
      return json({ ok: false, code: "tier_invalid", error: `tier must be 1 (2X) or 2 (5X), got ${JSON.stringify(String(body.tier).slice(0, 32))}` }, 400);
    }
    if (!Number.isInteger(months) || months < 1 || months > 12) {
      return json({ ok: false, error: "months must be 1 to 12" }, 400);
    }
    const { error } = await admin.rpc("premier_grant", {
      p_place_id: placeId,
      p_tier: tier,
      p_months: months,
      p_by: user.emailLower ?? user.id,
    });
    if (error) {
      const running = error.message.includes("a period is running");
      return json({ ok: false, error: running ? "This place already has a Premier period running" : error.message }, running ? 409 : 500);
    }
    return json({ ok: true });
  }

  if (body.action === "end") {
    const { error } = await admin.rpc("premier_end_grant", { p_place_id: placeId });
    if (error) {
      const none = error.message.includes("no running grant");
      return json({ ok: false, error: none ? "No grant is running" : error.message }, none ? 409 : 500);
    }
    return json({ ok: true });
  }

  if (body.action === "remove_pledge") {
    if (!isUuid(body.backingId)) return json({ ok: false, error: "backingId is required" }, 400);
    try {
      const pledge = await readPledge(admin, body.backingId);
      if (!pledge || pledge.place_id !== placeId || pledge.status === "ended") {
        return json({ ok: false, error: "Pledge not found" }, 404);
      }
      const key = boostStripeKey();
      await leavePledge(admin, key ? stripeClient(key) : null, pledge);
      return json({ ok: true });
    } catch (err) {
      console.error("[admin-web-grant-place-premier] remove_pledge", err);
      return json({ ok: false, error: "Couldn't remove the pledge. Try again." }, 500);
    }
  }

  return json({ ok: false, error: "action must be grant, end or remove_pledge" }, 400);
});
