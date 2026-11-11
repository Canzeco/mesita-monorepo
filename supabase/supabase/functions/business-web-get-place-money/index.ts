// Supabase Edge Function — business-web-get-place-money
//
// MESITA-3307 (W3): Business › Payments, the owner's money. Money received
// (vouchers and card parts net of refunds), Mesita's fee, credit outstanding
// (Available and Pending) and tips, then 50 rows newest first with a date
// range and a (created_at, id) cursor. The owner and Mesita staff only; an
// editor gets 403 `forbidden`. The universe is PAYMENTS_STRIPE_MODE's, never the
// body's, so a live row never shows under test. Who paid is the guest's
// name, else two characters of the email's local part; never the email.
//
// MESITA-3548 (Payments Flow v2, step D): money received counts outside
// bills the waiter marked Received; tips count card tips only (a cash tip is
// the waiter's, in person); each row says its confirmer (stripe · waiter ·
// credit), its outside part, the waiter's bill, its tab and part; the window's
// received_share and the place's outside cashback over the rolling day
// against OUTSIDE_CASHBACK_DAILY_CEILING_CENTS. Every new field is read by
// name with a default, so the old RPC shape still answers.
//
// Body: { place_id: uuid, from?: ISO, to?: ISO, before?: { created_at, id } }
// Response: { ok, test_mode, received_cents, fee_cents, tips_cents,
//             available_cents, pending_cents, received_share: { received, total },
//             outside_cashback_today_cents, outside_cashback_ceiling_cents,
//             rows: [...], next }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { maskGuest } from "../_shared/money-admin.ts";
import { OUTSIDE_CASHBACK_DAILY_CEILING_CENTS } from "../_shared/money.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

function isoOr(v: unknown, fallback: string): string | null {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) return null;
  return new Date(v).toISOString();
}

type Row = {
  kind: "voucher" | "payment";
  id: string;
  created_at: string;
  paid_at: string;
  status: string;
  voucher: string | null;
  ticket: string | null;
  amount_cents: number;
  credit_cents: number;
  card_cents: number;
  tip_cents: number;
  refunded_cents: number;
  confirmed_by?: string | null;
  outside_cents?: number | null;
  charge_amount_cents?: number | null;
  tab_id?: string | null;
  part?: string | null;
  cashback_cents?: number | null;
  outside_cashback_bps?: number | null;
  guest_name: string | null;
  guest_email: string | null;
};

const CONFIRMERS = new Set(["stripe", "waiter", "credit"]);
const PARTS = new Set(["credit", "outside", "card"]);

serveJson("business-web-get-place-money", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const b = bodyRes.body;
  if (!isUuid(b.place_id)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const access = await requirePlaceAccess(admin, user, b.place_id);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) {
    return json({ ok: false, code: "forbidden", error: "Only the place's owner sees its money" }, 403);
  }

  const from = isoOr(b.from, "2000-01-01T00:00:00.000Z");
  const to = isoOr(b.to, new Date(Date.now() + 86_400_000).toISOString());
  if (!from || !to) return json({ ok: false, error: "from and to must be dates" }, 400);
  const before = (b.before ?? null) as { created_at?: unknown; id?: unknown } | null;
  const beforeAt = before ? isoOr(before.created_at, "") : null;
  if (before && (!beforeAt || !isUuid(before.id))) {
    return json({ ok: false, error: "before must be { created_at, id }" }, 400);
  }

  const livemode = paymentsLivemode();
  const { data, error } = await admin.rpc("place_money_summary", {
    p_place_id: b.place_id,
    p_from: from,
    p_to: to,
    p_livemode: livemode,
    p_before: beforeAt || null,
    p_before_id: before ? before.id : null,
  });
  if (error) return json({ ok: false, error: `place_money_summary: ${error.message}` }, 500);
  const s = (data ?? {}) as Record<string, unknown>;
  const rows = ((s.rows ?? []) as Row[]).map(({ guest_name, guest_email, ...r }) => ({
    ...r,
    confirmed_by: CONFIRMERS.has(String(r.confirmed_by)) ? r.confirmed_by : null,
    outside_cents: Number(r.outside_cents ?? 0),
    charge_amount_cents: r.charge_amount_cents == null ? null : Number(r.charge_amount_cents),
    tab_id: typeof r.tab_id === "string" ? r.tab_id : null,
    part: PARTS.has(String(r.part)) ? r.part : null,
    cashback_cents: Number(r.cashback_cents ?? 0),
    outside_cashback_bps: Number(r.outside_cashback_bps ?? 0),
    guest: maskGuest(guest_name, guest_email),
  }));
  // MESITA-3709: a guest's own payment ends with the waiter's Verify. Each
  // row of a guest tab says when it was verified and by which phone (the last
  // four characters of the device hash, never the hash), or that it was not.
  // "Check this phone": a cash Verify from a phone that verified nothing else
  // here in 30 days (a leaked Staff QR looks like that).
  const tabIds = [...new Set(rows.map((r) => r.tab_id).filter((x): x is string => !!x))];
  const verify = new Map<string, { verified_at: string | null; phone: string | null; check_phone: boolean; cash: boolean; closed: boolean }>();
  if (tabIds.length) {
    const { data: tabs, error: tabErr } = await admin
      .from("pay_tabs")
      .select("id, origin, status, verified_at, verified_key_hash, cash_bill_cents, cash_tip_cents")
      .in("id", tabIds)
      .eq("origin", "guest");
    if (tabErr) return json({ ok: false, error: `pay_tabs: ${tabErr.message}` }, 500);
    type GuestTabRow = { id: string; status: string; verified_at: string | null; verified_key_hash: string | null; cash_bill_cents: number; cash_tip_cents: number };
    const guestTabs = (tabs ?? []) as GuestTabRow[];
    const keys = [...new Set(guestTabs.map((t) => t.verified_key_hash).filter((x): x is string => !!x))];
    const verifies = new Map<string, number>();
    if (keys.length) {
      const { data: seen, error: seenErr } = await admin
        .from("pay_tabs")
        .select("verified_key_hash")
        .eq("place_id", b.place_id)
        .in("verified_key_hash", keys)
        .gte("verified_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
        .limit(1000);
      if (seenErr) return json({ ok: false, error: `pay_tabs: ${seenErr.message}` }, 500);
      for (const r of (seen ?? []) as Array<{ verified_key_hash: string }>) verifies.set(r.verified_key_hash, (verifies.get(r.verified_key_hash) ?? 0) + 1);
    }
    for (const t of guestTabs) {
      const cash = t.cash_bill_cents + t.cash_tip_cents > 0;
      verify.set(t.id, {
        verified_at: t.verified_at,
        phone: t.verified_key_hash ? t.verified_key_hash.slice(-4) : null,
        check_phone: !!t.verified_key_hash && cash && (verifies.get(t.verified_key_hash) ?? 0) <= 1,
        cash,
        closed: t.status === "expired" || t.status === "cancelled" || (t.status === "paid" && !t.verified_at && cash),
      });
    }
  }
  const rowsOut = rows.map((r) => (r.tab_id && verify.has(r.tab_id) ? { ...r, guest_verify: verify.get(r.tab_id) } : r));

  const share = (s.received_share ?? {}) as { received?: unknown; total?: unknown };
  return json({
    ok: true,
    test_mode: !livemode,
    received_cents: Number(s.received_cents ?? 0),
    fee_cents: Number(s.fee_cents ?? 0),
    tips_cents: Number(s.tips_cents ?? 0),
    available_cents: Number(s.available_cents ?? 0),
    pending_cents: Number(s.pending_cents ?? 0),
    received_share: { received: Number(share.received ?? 0), total: Number(share.total ?? 0) },
    outside_cashback_today_cents: Number(s.outside_cashback_today_cents ?? 0),
    outside_cashback_ceiling_cents: OUTSIDE_CASHBACK_DAILY_CEILING_CENTS,
    rows: rowsOut,
    next: s.next ?? null,
  });
});
