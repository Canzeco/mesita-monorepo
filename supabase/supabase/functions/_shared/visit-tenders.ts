// visit_ticket_payments writers (MESITA-1910, MESITA-1913).
//
// Every ticket close records tenders through record_visit_tenders before the
// reveal; the DB constraint trigger on transition to `revealed` enforces the
// sum invariant at close time.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type VisitTenderMethod = "cash" | "card" | "mesita_pay";

export type VisitTenderRow = {
  method: VisitTenderMethod;
  amount_cents: number;
  stripe_payment_intent_id?: string | null;
};

/** Net pesos still owed after credits — same arithmetic as record_visit_tenders. */
export function netAmountDueCents(
  approvedAmountDueCents: number | null | undefined,
  creditsAppliedCents: number | null | undefined,
): number {
  return Math.max(
    0,
    (approvedAmountDueCents ?? 0) - (creditsAppliedCents ?? 0),
  );
}

// Checkout still has one live path (pay the place) with no cash/card split UI
// (MESITA-1913). Until split-tender exists, staff closers record one row for
// the whole net due; cash is the documented live example (Docs › Checkout §A).
export function impliedAtPlaceTenderRows(netCents: number): VisitTenderRow[] {
  if (netCents <= 0) return [];
  return [{ method: "cash", amount_cents: netCents }];
}

export function mesitaPayTenderRows(
  netCents: number,
  paymentIntentId: string,
): VisitTenderRow[] {
  return [{
    method: "mesita_pay",
    amount_cents: netCents,
    stripe_payment_intent_id: paymentIntentId,
  }];
}

type RecordVisitTendersResult = {
  ok?: boolean;
  idempotent?: boolean;
  code?: string;
};

export async function recordVisitTenders(
  admin: SupabaseClient,
  ticketId: string,
  tenders: VisitTenderRow[],
): Promise<
  | { ok: true; idempotent?: boolean }
  | { ok: false; code: string; error: string }
> {
  const { data, error } = await admin.rpc("record_visit_tenders", {
    p_ticket_id: ticketId,
    p_tenders: tenders,
  });
  if (error) {
    return { ok: false, code: "rpc_error", error: error.message };
  }
  const row = data as RecordVisitTendersResult | null;
  if (!row?.ok) {
    const code = row?.code ?? "unknown";
    return {
      ok: false,
      code,
      error: `record_visit_tenders: ${code}`,
    };
  }
  return { ok: true, idempotent: row.idempotent };
}
