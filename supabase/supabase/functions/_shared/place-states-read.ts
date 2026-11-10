// The raw Place States inputs (Main §10, MESITA-3586) for MANY places at
// once, for the admin console's tables (MESITA-3595). Business › Admin reads
// the same facts one place at a time through business-web-get-payments,
// -get-team and -get-billing; this reads them for a page of ids in one
// query per table, never one per place. The chips themselves are computed
// in the browser by @mesita/place-profile's moneyPlaceStates, the one
// calculation both apps share.
//
// Each group fails on its own: a failed read leaves that group null for the
// chunk ("?" on the table), never a false no.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  ACCOUNT_COLUMNS,
  type AccountRow,
  type AccountView,
  accountView,
  type PaymentKey,
  type PaymentSettings,
  type RateKey,
  SETTINGS_COLUMNS,
  settingsFromRow,
  type StripeState,
  stripeStateOf,
} from "./payments.ts";
import { FEE_INVOICE_COLUMNS, type FeeInvoiceRow, feeView } from "./fee-billing.ts";
import { isLiveManager } from "./place-access.ts";
import { TIER_RANK } from "./boost.ts";

/** What business-web-get-payments returns, minus what the table never
 *  shows (the invoice, the contract text). */
export type PaymentsFacts = {
  account: AccountView;
  settings: PaymentSettings;
  contract: { signed: boolean };
  code_set: boolean;
  fee_hold: boolean;
  fee_overdue: boolean;
};

export type PlaceStatesFacts = {
  /** A live owner seat (MESITA-3158); null = the read failed. */
  owned: boolean | null;
  /** The running subscription's rank, 1 = Pro · 2 = Max, 0 = Free; null =
   *  the read failed. */
  plan_rank: number | null;
  /** Null = one of the payment reads failed. */
  payments: PaymentsFacts | null;
};

export type PlaceStatesRead = {
  facts: Map<string, PlaceStatesFacts>;
  /** The admin console's three-value Stripe (MESITA-3395), from the same
   *  account read; absent for a place whose account read failed. */
  stripe: Map<string, StripeState>;
};

function fail(table: string, n: number, message: string) {
  console.error(`[place-states] ${table} read (${n} ids): ${message}`);
}

/** One query per table for `ids`. The caller chunks (ID_CHUNK): an `in`
 *  list rides in the URL. */
export async function readPlaceStatesFacts(
  admin: SupabaseClient,
  ids: string[],
  livemode: boolean,
  now: number = Date.now(),
): Promise<PlaceStatesRead> {
  const facts = new Map<string, PlaceStatesFacts>();
  const stripe = new Map<string, StripeState>();
  if (ids.length === 0) return { facts, stripe };

  const [accounts, settings, contracts, codes, invoices, managers, backings] = await Promise.all([
    admin.from("place_payment_accounts").select(ACCOUNT_COLUMNS).in("place_id", ids),
    admin.from("place_payment_settings").select(`place_id, ${SETTINGS_COLUMNS}`).in("place_id", ids),
    admin.from("house_credits_contracts").select("place_id").in("place_id", ids).is("ended_at", null),
    admin.from("place_codes").select("place_id").in("place_id", ids),
    admin
      .from("place_fee_invoices")
      .select(FEE_INVOICE_COLUMNS)
      .in("place_id", ids)
      .eq("livemode", livemode)
      .in("status", ["open", "uncollectible"]),
    admin
      .from("place_managers")
      .select("place_id, role, expires_at, revoked_at")
      .in("place_id", ids)
      .eq("role", "owner")
      .is("revoked_at", null),
    admin.from("place_backings").select("place_id, tier").in("place_id", ids).eq("status", "ready"),
  ]);

  const n = ids.length;
  for (const [name, res] of [
    ["place_payment_accounts", accounts],
    ["place_payment_settings", settings],
    ["house_credits_contracts", contracts],
    ["place_codes", codes],
    ["place_fee_invoices", invoices],
    ["place_managers", managers],
    ["place_backings", backings],
  ] as const) {
    if (res.error) fail(name, n, res.error.message);
  }

  const paymentsOk = !accounts.error && !settings.error && !contracts.error && !codes.error && !invoices.error;

  const accountBy = new Map<string, AccountRow>();
  for (const r of (accounts.data ?? []) as unknown as AccountRow[]) accountBy.set(r.place_id, r);
  const settingsBy = new Map<string, Partial<Record<PaymentKey | RateKey, unknown>>>();
  for (const r of (settings.data ?? []) as unknown as ({ place_id: string } & Record<string, unknown>)[]) {
    settingsBy.set(r.place_id, r as Partial<Record<PaymentKey | RateKey, unknown>>);
  }
  const signed = new Set(((contracts.data ?? []) as { place_id: string }[]).map((r) => r.place_id));
  const coded = new Set(((codes.data ?? []) as { place_id: string }[]).map((r) => r.place_id));
  const invoicesBy = new Map<string, FeeInvoiceRow[]>();
  for (const r of (invoices.data ?? []) as unknown as (FeeInvoiceRow & { place_id: string })[]) {
    const list = invoicesBy.get(r.place_id) ?? [];
    list.push(r);
    invoicesBy.set(r.place_id, list);
  }
  const owners = new Set<string>();
  for (const r of (managers.data ?? []) as { place_id: string; expires_at: string; revoked_at: string | null }[]) {
    if (isLiveManager(r, now)) owners.add(r.place_id);
  }
  const rankBy = new Map<string, number>();
  for (const r of (backings.data ?? []) as { place_id: string; tier: keyof typeof TIER_RANK }[]) {
    const rank = TIER_RANK[r.tier] ?? 0;
    rankBy.set(r.place_id, Math.max(rankBy.get(r.place_id) ?? 0, rank));
  }

  for (const id of ids) {
    const account = accountBy.get(id) ?? null;
    if (!accounts.error) stripe.set(id, stripeStateOf(account, livemode));
    // The same hold rule as business-web-get-payments: a hold in the
    // server's Stripe mode only.
    const hold = account?.livemode === livemode && account?.fee_hold === true;
    facts.set(id, {
      owned: managers.error ? null : owners.has(id),
      plan_rank: backings.error ? null : rankBy.get(id) ?? 0,
      payments: paymentsOk
        ? {
          account: accountView(account),
          settings: settingsFromRow(settingsBy.get(id) ?? null),
          contract: { signed: signed.has(id) },
          code_set: coded.has(id),
          fee_hold: hold,
          fee_overdue: feeView(hold, invoicesBy.get(id) ?? [], now).invoice?.overdue === true,
        }
        : null,
    });
  }
  return { facts, stripe };
}
