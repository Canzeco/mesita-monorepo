// Supabase Edge Function — business-web-list-place-visits
//
// MESITA-3202: Business › Visits, the log, newest first, a page at a time. The
// guest reads as a first name and a member number; a closed account has
// neither, and the place's record stays.
//
// Body: { place_id: uuid, before?: ISO timestamp }
// Response: { ok: true, can_void: boolean, timezone: string | null,
//             visits: [{ id, guest_name, member_number, bill_cents, currency,
//                        payment_method, reward_kind, reward_percent,
//                        discount_cents, total_cents, created_at, voided_at }],
//             next: ISO timestamp | null }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { canManage, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";

const PAGE = 30;

serveJson("business-web-list-place-visits", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, before } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (before !== undefined && (typeof before !== "string" || Number.isNaN(Date.parse(before)))) {
    return json({ ok: false, error: "before must be a timestamp" }, 400);
  }

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  const { data: place, error: placeErr } = await admin.from("places").select("timezone").eq("id", placeId).maybeSingle();
  if (placeErr) return json({ ok: false, error: `places: ${placeErr.message}` }, 500);

  let query = admin.from("place_visits")
    .select(
      "id, bill_cents, currency, payment_method, reward_kind, reward_percent, discount_cents, total_cents, created_at, voided_at, consumers(first_name, code, deleted_at)",
    )
    .eq("place_id", placeId)
    .order("created_at", { ascending: false })
    .limit(PAGE + 1);
  if (typeof before === "string") query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) return json({ ok: false, error: `place_visits: ${error.message}` }, 500);

  const rows = data ?? [];
  const page = rows.slice(0, PAGE);
  const visits = page.map(({ consumers, ...v }) => {
    const guest = (Array.isArray(consumers) ? consumers[0] : consumers) as
      | { first_name: string | null; code: string | null; deleted_at: string | null }
      | null;
    const live = guest && !guest.deleted_at ? guest : null;
    return { ...v, guest_name: live?.first_name ?? null, member_number: live?.code ?? null };
  });
  return json({
    ok: true,
    can_void: canManage(access.role),
    timezone: place?.timezone ?? null,
    visits,
    next: rows.length > PAGE ? page[page.length - 1].created_at : null,
  });
});
