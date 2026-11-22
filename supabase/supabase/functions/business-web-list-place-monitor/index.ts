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
// Response: { ok, test_mode, kind, timezone, rows, next, analytics? }
//
// MESITA-4677 (Pato: "add analytics to visits and vouchers too"): on the
// first, unfiltered page of visits or vouchers, `analytics` is synthesized
// here from every raw row (pay_tabs, wallet_purchases; the same rows the list
// shows), read in pages. Nothing is stored (Rules §2).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, requirePlaceAccess } from "../_shared/place-access.ts";
import { readBoostPlace } from "../_shared/boost.ts";
import { isUuid } from "../_shared/place-id.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { isCustomerKey, maskMonitorRow, MONITOR_KINDS } from "../_shared/monitor.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { synthesizeVisits, synthesizeVouchers, type VisitRow, type VoucherRow } from "./analytics.ts";

const DEFAULT_TIMEZONE = "America/Mexico_City";
const PAGE = 1000;

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
  const wantsAnalytics = !before && b.customer == null && b.id == null && (b.kind === "visits" || b.kind === "vouchers");
  const analyticsP = wantsAnalytics ? readAnalytics(admin, b.place_id, livemode, b.kind as "visits" | "vouchers") : null;
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

  const analytics = analyticsP ? await analyticsP : null;
  if (analytics && "error" in analytics) {
    console.error(`[monitor] analytics kind=${b.kind} place=${b.place_id} error=${analytics.error}`);
    return json({ ok: false, error: `analytics: ${analytics.error}` }, 500);
  }

  const s = (data ?? {}) as { rows?: Array<Record<string, unknown>>; next?: unknown };
  return json({
    ok: true,
    test_mode: !livemode,
    kind: b.kind,
    timezone: usableTimezone(placeRes.place?.timezone),
    rows: (s.rows ?? []).map(maskMonitorRow),
    next: s.next ?? null,
    ...(analytics ? { analytics: analytics.value } : {}),
  });
});

/** Every raw row the list shows, in pages. Same filters as place_monitor_list. */
async function readAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<{ rows: T[] } | { error: string }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) return { error: error.message };
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) return { rows };
  }
}

async function readAnalytics(
  admin: SupabaseClient,
  placeId: string,
  livemode: boolean,
  kind: "visits" | "vouchers",
): Promise<{ value: unknown } | { error: string }> {
  const now = Date.now();
  if (kind === "visits") {
    const r = await readAll<{ consumer_id: string | null; paid_at: string | null; created_at: string; status: string; origin: string; verified_at: string | null; bill_cents: number | null; tip_cents: number | null }>(
      (from, to) =>
        admin
          .from("pay_tabs")
          .select("id, consumer_id, paid_at, created_at, status, origin, verified_at, bill_cents, tip_cents")
          .eq("place_id", placeId)
          .eq("livemode", livemode)
          .in("status", ["paid", "waiting_bill", "billed", "paying"])
          .order("created_at")
          .order("id")
          .range(from, to),
    );
    if ("error" in r) return r;
    const rows: VisitRow[] = r.rows
      .filter((t) => t.status === "paid" ? t.origin !== "guest" || t.verified_at !== null : t.origin !== "guest")
      .map((t) => ({ consumer_id: t.consumer_id, at: t.paid_at ?? t.created_at, status: t.status, bill_cents: t.bill_cents, tip_cents: t.tip_cents }));
    return { value: synthesizeVisits(rows, now) };
  }
  const r = await readAll<VoucherRow & { paid_at: string }>(
    (from, to) =>
      admin
        .from("wallet_purchases")
        .select("id, consumer_id, paid_at, amount_cents, bonus_cents, refunded_cents")
        .eq("place_id", placeId)
        .eq("livemode", livemode)
        .not("paid_at", "is", null)
        .order("paid_at")
        .order("id")
        .range(from, to),
  );
  if ("error" in r) return r;
  return { value: synthesizeVouchers(r.rows.map((v) => ({ ...v, at: v.paid_at })), now) };
}
