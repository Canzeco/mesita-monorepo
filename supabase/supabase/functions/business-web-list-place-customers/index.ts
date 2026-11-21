// Supabase Edge Function — business-web-list-place-customers
//
// MESITA-4538: Business › Monitor › Customers (Pato: "it counts the people
// and how much you owe them"). Guests with any money row at the place in
// this universe, what the place owes each, when they were last seen; plus
// the count and the total owed. The owner and Mesita staff only.
//
// Body: { place_id, customer?: key, before?: { owed, last_seen, key } }
// Response: { ok, test_mode, timezone, count, owed_cents, rows, next }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, requirePlaceAccess } from "../_shared/place-access.ts";
import { readBoostPlace } from "../_shared/boost.ts";
import { isUuid } from "../_shared/place-id.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { maskGuest } from "../_shared/money-admin.ts";
import { isCustomerKey } from "../_shared/monitor.ts";

serveJson("business-web-list-place-customers", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const b = bodyRes.body;
  if (!isUuid(b.place_id)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (b.customer != null && !isCustomerKey(b.customer)) return json({ ok: false, error: "customer must be a customer key" }, 400);
  const before = (b.before ?? null) as { owed?: unknown; last_seen?: unknown; key?: unknown } | null;
  if (
    before &&
    (!Number.isInteger(Number(before.owed)) || typeof before.last_seen !== "string" || Number.isNaN(Date.parse(before.last_seen)) || !isCustomerKey(before.key))
  ) {
    return json({ ok: false, error: "before must be { owed, last_seen, key }" }, 400);
  }

  const access = await requirePlaceAccess(admin, user, b.place_id);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) {
    return json({ ok: false, code: "owner_only", error: "Only the place's owner sees these" }, 403);
  }

  const placeRes = await readBoostPlace(admin, b.place_id);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);

  const livemode = paymentsLivemode();
  const { data, error } = await admin.rpc("place_customers", {
    p_place_id: b.place_id,
    p_livemode: livemode,
    p_customer: b.customer ?? null,
    p_before: before ? { owed: Number(before.owed), last_seen: before.last_seen, key: before.key } : null,
  });
  if (error) {
    console.error(`[customers] place=${b.place_id} error=${error.message}`);
    return json({ ok: false, error: `place_customers: ${error.message}` }, 500);
  }

  const s = (data ?? {}) as { count?: number; owed_cents?: number; rows?: Array<Record<string, unknown>>; next?: unknown };
  const rows = (s.rows ?? []).map((r) => ({
    customer: r.customer,
    owed_cents: Number(r.owed_cents ?? 0),
    last_seen: r.last_seen,
    guest: maskGuest(r.guest_name as string | null, r.guest_email as string | null),
  }));
  return json({
    ok: true,
    test_mode: !livemode,
    timezone: placeRes.place?.timezone ?? "America/Mexico_City",
    count: Number(s.count ?? 0),
    owed_cents: Number(s.owed_cents ?? 0),
    rows,
    next: s.next ?? null,
  });
});
