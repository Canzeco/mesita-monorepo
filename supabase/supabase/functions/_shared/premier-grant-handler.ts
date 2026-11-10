// Premier Refill from Manage Multiple › Refill (refill, end_mesita_days,
// MESITA-3163) and removing one pledge — the body behind
// admin-web-grant-place-premier. It opens with requireAdminRequest
// (super_admins); the EF name is the caller. The batch actions take Google
// Place IDs and dispatch before the placeId check.

import { json, readJson, readPlaceIdAlias } from "./http.ts";
import { readPledge } from "./boost.ts";
import { isUuid } from "./place-id.ts";
import { parseRefillBody, resolveGooglePlaceIds, runRefill } from "./premier-refill.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { boostStripeKey, stripeClient } from "./stripe.ts";
import { leavePledge } from "./boost-writes.ts";

export async function handleGrantPlacePremier(req: Request, source: string): Promise<Response> {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  if (body.action === "refill" || body.action === "end_mesita_days") {
    const parsed = parseRefillBody(body);
    if ("code" in parsed) return json({ ok: false, code: parsed.code, error: parsed.error }, 400);
    const requestId = parsed.action === "refill" ? parsed.requestId : crypto.randomUUID();
    try {
      const lines = await runRefill(parsed, {
        resolve: (ids) => resolveGooglePlaceIds(admin, ids),
        rpc: async (fn, args) => {
          const { data, error } = await admin.rpc(fn, args);
          return { data, error };
        },
        by: user.emailLower ?? user.id,
        requestId,
      });
      return json({ ok: true, lines });
    } catch (err) {
      console.error(`[${source}] ${parsed.action}`, requestId, err);
      return json({ ok: false, code: "refill_failed", error: "Couldn't run Upgrade. Retry unfinished resends it.", request_id: requestId }, 500);
    }
  }

  const placeId = readPlaceIdAlias(body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  if (body.action === "remove_pledge") {
    if (!isUuid(body.backingId)) return json({ ok: false, error: "backingId is required" }, 400);
    try {
      const pledge = await readPledge(admin, body.backingId);
      if (!pledge || pledge.place_id !== placeId || pledge.status === "ended") {
        return json({ ok: false, error: "Pledge not found" }, 404);
      }
      const key = boostStripeKey();
      await leavePledge(admin, key ? stripeClient(key) : null, pledge, "left");
      return json({ ok: true });
    } catch (err) {
      console.error(`[${source}] remove_pledge`, err);
      return json({ ok: false, error: "Couldn't remove the pledge. Try again." }, 500);
    }
  }

  return json({ ok: false, error: "action must be refill, end_mesita_days or remove_pledge" }, 400);
}
