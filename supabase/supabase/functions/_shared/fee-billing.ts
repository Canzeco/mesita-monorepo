// Fee billing (MESITA-3461). Charge model d5a (the /autoplan gate of
// 2026-11-08): every voucher purchase and every card part is a direct charge
// on the place's connected account with NO application fee; Mesita's 5% is
// billed to the place apart, on a Stripe invoice from Mesita's own account.
//
// What a row owes is application_fee_cents - fee_refunded_cents (the refund
// RPCs write the refunded share, so a refunded or lost-dispute part owes
// nothing) minus fee_billed_cents (what earlier invoices claimed). Rows from
// before today carry fee_collected = 'application_fee' and are never billed.
//
// One tick of supabase-cron-bill-fees (every hour):
//   1. claim: per place with an account in this Stripe universe,
//      place_fee_claim moves what is owed onto a draft invoice when it is due:
//      at least FEE_MIN_CENTS (Stripe's minimum) and either FEE_THRESHOLD_CENTS
//      (MX$500) owed or the oldest unbilled paid row older than
//      FEE_PERIOD_DAYS (weekly);
//   2. issue: each draft becomes a Stripe invoice to the place's customer on
//      Mesita's account (collection_method send_invoice, due in
//      FEE_DAYS_UNTIL_DUE days, one line), finalized; every call keyed by the
//      draft's id, so a retry makes nothing twice;
//   3. sync: every open or uncollectible invoice is read back and stored;
//      place_fee_invoice_set recomputes fee_hold (an open invoice past due,
//      or an uncollectible one, holds the place's cards off). A hold that
//      turns on logs `fee_unpaid_cards_off`; one that clears logs
//      `fee_paid_cards_back`. The owner's own pay_cards switch is never read
//      or written here.
//
// No Stripe webhook on Mesita's own account: the EF name is the ACL and no
// caller prefix is Stripe's (Rules §2), so Mesita polls (the Premier shape).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { MIN_CHARGE_CENTS, MONEY_CURRENCY } from "./money.ts";
import { readVoucherPlace } from "./wallet.ts";
import { type StripeCall, StripeError } from "./stripe.ts";
import { errorMessage } from "./errors.ts";

/** An invoice is sent once this much is owed, whatever the week says. */
export const FEE_THRESHOLD_CENTS = 500_00;
/** Otherwise weekly: the oldest unbilled paid row this many days old. */
export const FEE_PERIOD_DAYS = 7;
/** Days the place has to pay before its cards turn off. */
export const FEE_DAYS_UNTIL_DUE = 7;
/** Below Stripe's minimum charge nothing is sent; it carries to next time. */
export const FEE_MIN_CENTS = MIN_CHARGE_CENTS[MONEY_CURRENCY] ?? 10_00;

export type FeeInvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";

export type FeeInvoiceRow = {
  id: string;
  place_id: string;
  livemode: boolean;
  currency: string;
  amount_cents: number;
  status: FeeInvoiceStatus;
  stripe_invoice_id: string | null;
  hosted_invoice_url: string | null;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export const FEE_INVOICE_COLUMNS =
  "id, place_id, livemode, currency, amount_cents, status, stripe_invoice_id, hosted_invoice_url, due_at, paid_at, created_at";

/** Stripe's invoice status as ours; an unknown one reads open (held to its due date). */
export function feeStatusOf(invoice: Record<string, unknown>): FeeInvoiceStatus {
  const s = invoice.status;
  return s === "draft" || s === "open" || s === "paid" || s === "void" || s === "uncollectible" ? s : "open";
}

function isoOf(sec: unknown): string | null {
  return typeof sec === "number" && sec > 0 ? new Date(sec * 1000).toISOString() : null;
}

/** The arguments place_fee_invoice_set takes for what Stripe said. Pure. */
export function invoiceSetArgs(rowId: string, invoice: Record<string, unknown>, customerId?: string | null) {
  const transitions = (invoice.status_transitions ?? {}) as Record<string, unknown>;
  return {
    p_invoice_id: rowId,
    p_status: feeStatusOf(invoice),
    p_stripe_invoice_id: typeof invoice.id === "string" ? invoice.id : null,
    p_customer_id: customerId ?? (typeof invoice.customer === "string" ? invoice.customer : null),
    p_url: typeof invoice.hosted_invoice_url === "string" ? invoice.hosted_invoice_url : null,
    p_due_at: isoOf(invoice.due_date),
    p_paid_at: isoOf(transitions.paid_at),
    p_error: null,
  };
}

/** The invoice on Mesita's account. Pure. */
export function feeInvoiceParams(args: { rowId: string; placeId: string; customer: string }): Record<string, unknown> {
  return {
    customer: args.customer,
    collection_method: "send_invoice",
    days_until_due: FEE_DAYS_UNTIL_DUE,
    auto_advance: true,
    pending_invoice_items_behavior: "exclude",
    description: "Mesita's 5% fee on Mesita Payments and Mesita Prepayments.",
    metadata: { mesita_kind: "place_fee", fee_invoice_id: args.rowId, place_id: args.placeId },
  };
}

/** Its one line. Pure. */
export function feeItemParams(args: { rowId: string; customer: string; invoice: string; amountCents: number; currency: string }): Record<string, unknown> {
  return {
    customer: args.customer,
    invoice: args.invoice,
    amount: args.amountCents,
    currency: args.currency,
    description: "Mesita fee: 5% of card payments and vouchers",
    metadata: { mesita_kind: "place_fee", fee_invoice_id: args.rowId },
  };
}

type AccountFeeRow = { place_id: string; livemode: boolean; fee_customer_id: string | null };

/** The place owner's email, for the invoice; null when none. */
async function ownerEmail(admin: SupabaseClient, placeId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("place_managers")
    .select("consumer_id")
    .eq("place_id", placeId)
    .eq("role", "owner")
    .is("revoked_at", null)
    .limit(1);
  if (error) throw new Error(`place_managers: ${error.message}`);
  const id = (data?.[0] as { consumer_id?: string } | undefined)?.consumer_id;
  if (!id) return null;
  const { data: user } = await admin.auth.admin.getUserById(id);
  return user?.user?.email ?? null;
}

/** The place's customer on Mesita's account in this universe, made once
 *  (the Idempotency-Key makes two ticks at once share one). */
export async function ensureFeeCustomer(admin: SupabaseClient, stripe: StripeCall, account: AccountFeeRow): Promise<string> {
  if (account.fee_customer_id) return account.fee_customer_id;
  const placeRes = await readVoucherPlace(admin, account.place_id);
  if (!placeRes.ok) throw new Error(placeRes.error);
  const email = await ownerEmail(admin, account.place_id);
  const created = await stripe(
    "POST",
    "customers",
    {
      name: String(placeRes.place?.name ?? "Mesita place").slice(0, 250),
      ...(email ? { email } : {}),
      metadata: { mesita_kind: "place_fee", place_id: account.place_id },
    },
    { idempotencyKey: `place-fee-customer:${account.place_id}:${account.livemode ? "live" : "test"}` },
  );
  const id = typeof created.id === "string" ? created.id : "";
  if (!id) throw new Error("fee_customer_create: no id");
  const { error } = await admin.from("place_payment_accounts").update({ fee_customer_id: id }).eq("place_id", account.place_id);
  if (error) throw new Error(`fee_customer_write: ${error.message}`);
  return id;
}

async function setInvoice(admin: Pick<SupabaseClient, "rpc">, args: Record<string, unknown>): Promise<{ fee_hold: boolean; changed: boolean; place_id: string }> {
  const { data, error } = await admin.rpc("place_fee_invoice_set", args);
  if (error) throw new Error(`place_fee_invoice_set: ${error.message}`);
  const res = (data ?? {}) as { ok?: boolean; code?: string; fee_hold?: boolean; changed?: boolean; place_id?: string };
  if (res.ok !== true) throw new Error(`place_fee_invoice_set: ${res.code ?? "failed"}`);
  const out = { fee_hold: res.fee_hold === true, changed: res.changed === true, place_id: String(res.place_id ?? "") };
  if (out.changed) {
    console.log(`[fee-billing] ${out.fee_hold ? "fee_unpaid_cards_off" : "fee_paid_cards_back"}`, JSON.stringify({ place_id: out.place_id, invoice_id: args.p_invoice_id }));
  }
  return out;
}

/** A draft row becomes a finalized Stripe invoice. Every call is keyed by
 *  the row id: a retry after a failure returns what was made, never a twin. */
export async function issueFeeInvoice(
  admin: SupabaseClient,
  stripe: StripeCall,
  row: Pick<FeeInvoiceRow, "id" | "place_id" | "amount_cents" | "currency">,
  customer: string,
): Promise<FeeInvoiceStatus> {
  try {
    let invoice = await stripe("POST", "invoices", feeInvoiceParams({ rowId: row.id, placeId: row.place_id, customer }), {
      idempotencyKey: `place-fee-invoice:${row.id}`,
    });
    const invoiceId = String(invoice.id ?? "");
    if (!invoiceId) throw new Error("invoice_create: no id");
    await stripe("POST", "invoiceitems", feeItemParams({ rowId: row.id, customer, invoice: invoiceId, amountCents: row.amount_cents, currency: row.currency }), {
      idempotencyKey: `place-fee-item:${row.id}`,
    });
    if (invoice.status === "draft") {
      invoice = await stripe("POST", `invoices/${encodeURIComponent(invoiceId)}/finalize`, { auto_advance: true }, {
        idempotencyKey: `place-fee-finalize:${row.id}`,
      });
    }
    const args = invoiceSetArgs(row.id, invoice, customer);
    // Finalized: never draft on our side again, or the claim would retry it.
    if (args.p_status === "draft") args.p_status = "open";
    await setInvoice(admin, args);
    return args.p_status;
  } catch (err) {
    const code = err instanceof StripeError ? err.code || err.type || "stripe_error" : errorMessage(err);
    console.error("[fee-billing] issue_failed", JSON.stringify({ invoice_id: row.id, place_id: row.place_id, code }));
    await admin.rpc("place_fee_invoice_set", { p_invoice_id: row.id, p_status: "draft", p_error: String(code).slice(0, 500) });
    return "draft";
  }
}

export type FeeTickReport = { claimed: number; issued: number; synced: number; held: number; released: number; failed: number };

export type FeeTickDeps = { admin: SupabaseClient; stripe: StripeCall; livemode: boolean; limit: number };

/** One tick: claim, issue, sync (see the header). A failure on one place
 *  is logged and counted; the rest go on. */
export async function runFeeBillingTick(deps: FeeTickDeps): Promise<FeeTickReport> {
  const { admin, stripe, livemode, limit } = deps;
  const report: FeeTickReport = { claimed: 0, issued: 0, synced: 0, held: 0, released: 0, failed: 0 };

  // 1 + 2. Claim and issue.
  const { data: accounts, error: accErr } = await admin
    .from("place_payment_accounts")
    .select("place_id, livemode, fee_customer_id")
    .eq("livemode", livemode)
    .limit(limit);
  if (accErr) throw new Error(`place_payment_accounts: ${accErr.message}`);
  for (const account of (accounts ?? []) as AccountFeeRow[]) {
    try {
      const { data, error } = await admin.rpc("place_fee_claim", {
        p_place_id: account.place_id,
        p_livemode: livemode,
        p_currency: MONEY_CURRENCY,
        p_min_cents: FEE_MIN_CENTS,
        p_threshold_cents: FEE_THRESHOLD_CENTS,
        p_period: `${FEE_PERIOD_DAYS} days`,
      });
      if (error) throw new Error(`place_fee_claim: ${error.message}`);
      const claim = (data ?? {}) as { ok?: boolean; outcome?: string; invoice_id?: string; amount_cents?: number; currency?: string };
      if (claim.ok !== true) throw new Error(`place_fee_claim: ${JSON.stringify(claim)}`);
      if (claim.outcome !== "claimed" && claim.outcome !== "draft") continue;
      if (claim.outcome === "claimed") report.claimed++;
      const customer = await ensureFeeCustomer(admin, stripe, account);
      const status = await issueFeeInvoice(admin, stripe, {
        id: String(claim.invoice_id),
        place_id: account.place_id,
        amount_cents: Number(claim.amount_cents),
        currency: String(claim.currency ?? MONEY_CURRENCY),
      }, customer);
      if (status === "draft") report.failed++;
      else report.issued++;
    } catch (err) {
      report.failed++;
      console.error("[fee-billing] claim_failed", JSON.stringify({ place_id: account.place_id, error: errorMessage(err) }));
    }
  }

  // 3. Sync what is still owed.
  const { data: open, error: openErr } = await admin
    .from("place_fee_invoices")
    .select(FEE_INVOICE_COLUMNS)
    .eq("livemode", livemode)
    .in("status", ["open", "uncollectible"])
    .not("stripe_invoice_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (openErr) throw new Error(`place_fee_invoices: ${openErr.message}`);
  for (const row of (open ?? []) as FeeInvoiceRow[]) {
    try {
      const invoice = await stripe("GET", `invoices/${encodeURIComponent(String(row.stripe_invoice_id))}`);
      const res = await setInvoice(admin, invoiceSetArgs(row.id, invoice));
      report.synced++;
      if (res.changed) res.fee_hold ? report.held++ : report.released++;
    } catch (err) {
      report.failed++;
      console.error("[fee-billing] sync_failed", JSON.stringify({ invoice_id: row.id, error: errorMessage(err) }));
    }
  }
  return report;
}

/** What Business › Payments shows: the hold and the invoice to pay, the
 *  oldest one that holds first, else the newest open one. */
export type FeeView = {
  hold: boolean;
  invoice: null | { amount_cents: number; currency: string; due_at: string | null; url: string | null; overdue: boolean };
};

export function feeView(hold: boolean, invoices: Pick<FeeInvoiceRow, "status" | "amount_cents" | "currency" | "due_at" | "hosted_invoice_url" | "created_at">[], nowMs: number): FeeView {
  const unpaid = invoices.filter((i) => i.status === "open" || i.status === "uncollectible");
  const overdue = (i: (typeof unpaid)[number]) => i.status === "uncollectible" || (!!i.due_at && Date.parse(i.due_at) < nowMs);
  const pick = [...unpaid].sort((a, b) => Number(overdue(b)) - Number(overdue(a)) || a.created_at.localeCompare(b.created_at))[0];
  return {
    hold,
    invoice: pick
      ? { amount_cents: pick.amount_cents, currency: pick.currency, due_at: pick.due_at, url: pick.hosted_invoice_url, overdue: overdue(pick) }
      : null,
  };
}
