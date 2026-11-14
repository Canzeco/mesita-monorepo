// Removing one pledge — the body behind admin-web-grant-place-premier. It
// opens with requireAdminRequest (super_admins); the EF name is the caller.
// Mesita's manual Upgrade (refill, end_mesita_days, MESITA-3163) is gone
// (MESITA-3938): those actions answer 410, so Premier comes only from a
// payment.

import { json, readJson, readPlaceIdAlias } from "./http.ts";
import { readPledge } from "./boost.ts";
import { isUuid } from "./place-id.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { boostStripeKey, stripeClient } from "./stripe.ts";
import { leavePledge } from "./boost-writes.ts";

export async function handleGrantPlacePremier(req: Request, source: string): Promise<Response> {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  // Mesita gives no Premier (MESITA-3938, Pato: "Kill the manual Upgrade
  // button. They do need to pay"): refill and end_mesita_days are gone.
  if (body.action === "refill" || body.action === "end_mesita_days") {
    return json({ ok: false, code: "manual_upgrade_removed", error: "Mesita no longer gives Upgrades. Premier is paid." }, 410);
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

  return json({ ok: false, error: "action must be remove_pledge" }, 400);
}
