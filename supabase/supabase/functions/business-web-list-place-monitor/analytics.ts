// Monitor analytics (MESITA-4677). Pure: synthesized from the raw rows on
// every load, never stored (Rules §2: analytics are computed, never stored).

export type VisitRow = {
  consumer_id: string | null;
  at: string;
  status: string;
  bill_cents: number | null;
  tip_cents: number | null;
};

export type VoucherRow = {
  consumer_id: string | null;
  at: string;
  amount_cents: number | null;
  bonus_cents: number | null;
  refunded_cents: number | null;
};

export type VisitsAnalytics = {
  visits: number;
  open: number;
  guests: number;
  returning: number;
  visits7d: number;
  visits30d: number;
  billed_cents: number;
  tips_cents: number;
  average_bill_cents: number;
};

export type VouchersAnalytics = {
  vouchers: number;
  guests: number;
  returning: number;
  vouchers7d: number;
  vouchers30d: number;
  paid_cents: number;
  bonus_cents: number;
  refunded_cents: number;
};

const DAY_MS = 86_400_000;

/** Guests, and guests seen on two or more different days. */
function people(rows: Array<{ consumer_id: string | null; at: string }>): { guests: number; returning: number } {
  const days = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.consumer_id) continue;
    let d = days.get(r.consumer_id);
    if (!d) days.set(r.consumer_id, (d = new Set()));
    d.add(r.at.slice(0, 10));
  }
  let returning = 0;
  for (const d of days.values()) if (d.size > 1) returning++;
  return { guests: days.size, returning };
}

function recent(rows: Array<{ at: string }>, now: number, days: number): number {
  const since = now - days * DAY_MS;
  return rows.filter((r) => Date.parse(r.at) >= since).length;
}

export function synthesizeVisits(rows: VisitRow[], now: number): VisitsAnalytics {
  const paid = rows.filter((r) => r.status === "paid");
  const billed = paid.reduce((s, r) => s + (r.bill_cents ?? 0), 0);
  return {
    visits: paid.length,
    open: rows.length - paid.length,
    ...people(paid),
    visits7d: recent(paid, now, 7),
    visits30d: recent(paid, now, 30),
    billed_cents: billed,
    tips_cents: paid.reduce((s, r) => s + (r.tip_cents ?? 0), 0),
    average_bill_cents: paid.length ? Math.round(billed / paid.length) : 0,
  };
}

export function synthesizeVouchers(rows: VoucherRow[], now: number): VouchersAnalytics {
  return {
    vouchers: rows.length,
    ...people(rows),
    vouchers7d: recent(rows, now, 7),
    vouchers30d: recent(rows, now, 30),
    paid_cents: rows.reduce((s, r) => s + (r.amount_cents ?? 0), 0),
    bonus_cents: rows.reduce((s, r) => s + (r.bonus_cents ?? 0), 0),
    refunded_cents: rows.reduce((s, r) => s + (r.refunded_cents ?? 0), 0),
  };
}
