// Supabase Edge Function — business-web-list-place-monitor
//
// MESITA-4538: Business › Monitor's plain lists. One page of visits,
// vouchers, gifts, payments or credits (the credit ledger) at one place,
// newest first, each row with the ids of the rows it relates to. The owner
// and Mesita staff only; an editor gets 403. The universe is
// PAYMENTS_STRIPE_MODE's. Guests are per-place keys and masked names; the
// email and the member id never leave this function.
//
// Body: { place_id, kind: visits|vouchers|gifts|payments|credits,
//         customer?: key, id?: uuid, before?: { rank, at, id } }
// Response: { ok, test_mode, kind, timezone, rows, next }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, requirePlaceAccess } from "../_shared/place-access.ts";
import { readBoostPlace } from "../_shared/boost.ts";
import { isUuid } from "../_shared/place-id.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { isCustomerKey, maskMonitorRow, MONITOR_KINDS } from "../_shared/monitor.ts";

const DEFAULT_TIMEZONE = "America/Mexico_City";

function usableTimezone(timezone: string | null | undefined): string {
  if (!timezone) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

serveJson("business-web-list-place-monitor", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const b = bodyRes.body;
  if (!isUuid(b.place_id)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (typeof b.kind !== "string" || !(MONITOR_KINDS as readonly string[]).includes(b.kind)) {
    return json({ ok: false, error: "kind must be visits, vouchers, gifts, payments or credits" }, 400);
  }
  if (b.customer != null && !isCustomerKey(b.customer)) return json({ ok: false, error: "customer must be a customer key" }, 400);
  if (b.id != null && !isUuid(b.id)) return json({ ok: false, error: "id must be a uuid" }, 400);
  const before = (b.before ?? null) as { rank?: unknown; at?: unknown; id?: unknown } | null;
  if (
    before &&
    (typeof before.at !== "string" || Number.isNaN(Date.parse(before.at)) || !isUuid(before.id) || !Number.isInteger(Number(before.rank)))
  ) {
    return json({ ok: false, error: "before must be { rank, at, id }" }, 400);
  }

  const access = await requirePlaceAccess(admin, user, b.place_id);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) {
    return json({ ok: false, code: "owner_only", error: "Only the place's owner sees these" }, 403);
  }

  const placeRes = await readBoostPlace(admin, b.place_id);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);

  const livemode = paymentsLivemode();
  const { data, error } = await admin.rpc("place_monitor_list", {
    p_place_id: b.place_id,
    p_livemode: livemode,
    p_kind: b.kind,
    p_customer: b.customer ?? null,
    p_id: b.id ?? null,
    p_before: before ? { rank: Number(before.rank), at: before.at, id: before.id } : null,
  });
  if (error) {
    console.error(`[monitor] kind=${b.kind} place=${b.place_id} error=${error.message}`);
    return json({ ok: false, error: `place_monitor_list: ${error.message}` }, 500);
  }

  const s = (data ?? {}) as { rows?: Array<Record<string, unknown>>; next?: unknown };
  return json({
    ok: true,
    test_mode: !livemode,
    kind: b.kind,
    timezone: usableTimezone(placeRes.place?.timezone),
    rows: (s.rows ?? []).map(maskMonitorRow),
    next: s.next ?? null,
  });
});
