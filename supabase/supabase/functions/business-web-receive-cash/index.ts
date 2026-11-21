// Supabase Edge Function — business-web-receive-cash
//
// MESITA-4502: a signed-in business user marks a guest's cash amount
// received. No waiter code. The closed ticket is written here. A second
// tap returns the first result. A mismatched amount writes nothing.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { callTabRpc, rpcRefusal } from "../_shared/tab.ts";

serveJson("business-web-receive-cash", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  const attemptId = bodyRes.body.attempt_id;
  const amount = bodyRes.body.amount_cents;
  if (!isUuid(placeId) || !isUuid(attemptId) || typeof amount !== "number" || !Number.isInteger(amount)) {
    return json({ ok: false, code: "bad_request", error: "place_id, attempt_id, and amount_cents are required" }, 400);
  }
  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  const r = await callTabRpc(admin, "pay_guest_receive", {
    p_attempt_id: attemptId,
    p_place_id: placeId,
    p_amount_cents: amount,
  });
  if (r.ok !== true) {
    const refusal = rpcRefusal(r);
    const status = refusal.code === "forbidden" ? 403 : refusal.code === "amount_changed" ? 409 : 409;
    return json({ ok: false, code: refusal.code, error: refusal.code === "amount_changed" ? "Amount changed. Refresh this list." : refusal.error }, status);
  }
  return json({ ok: true, outcome: r.outcome, tab_id: r.tab_id ?? null });
});
