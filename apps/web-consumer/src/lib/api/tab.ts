// Pay at the table, the guest's side (MESITA-3564, cards MESITA-3572). The
// guest opens a tab at a place and shows its QR; the waiter types the bill
// and a tip suggestion on visit.mesita.ai; the guest chooses how to pay the
// bill (credits first, the rest in cash or by card) and the tip (cash or
// card; credits never pay a tip); a card part is charged inside the app on
// the place's Stripe account (a bank check, 3-D Secure, runs in Stripe.js);
// a cash part waits for the waiter's Received. The server is the last word on
// every amount; tabSplit is only what the screen proposes.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type TabStatus =
  "waiting_bill" | "billed" | "paying" | "paid" | "expired" | "cancelled";

/** What consumer-web-get-tab answers. */
export type GuestTab = {
  tab_id: string;
  place: { id: string; name: string | null };
  status: TabStatus;
  currency: string;
  bill_cents: number | null;
  /** The waiter's tip suggestion; the guest decides. */
  tip_suggested_cents: number;
  bill_version: number;
  ticket: string | null;
  waiter_name: string | null;
  /** The guest's credit here they can spend now. */
  spendable_cents: number;
  rates: {
    cash_back_bps: number;
    card_back_bps: number;
    card_available: boolean;
    card_unavailable_code: string | null;
    /** Stripe's minimum for the card part (bill + tip by card). */
    card_minimum_cents: number;
  };
  credit_cents: number;
  cash_bill_cents: number;
  cash_tip_cents: number;
  cash_due_cents: number;
  cash_received_cents: number | null;
  card_bill_cents: number;
  card_tip_cents: number;
  cashback_cents: number;
  /** The payment rows the guest's split opened: `card` and `outside` (cash). */
  parts: Array<{
    id: string;
    part: string | null;
    status: string;
    paid_at: string | null;
  }>;
  paid_at: string | null;
  expires_at: string;
  updated_at: string;
  test_mode: boolean;
};

export type OpenedTab = {
  tab_id: string;
  outcome: "opened" | "reused";
  status: TabStatus;
  /** The waiter's link; null once the tab is billed (no QR needed). */
  qr_url: string | null;
  expires_at: string;
  test_mode: boolean;
};

/** Opens a tab at a place, or reuses this guest's open one there. While it
 *  waits for the bill, every open mints a new QR (only the newest works). */
export async function apiOpenTab(
  client: SupabaseClient,
  placeId: string,
): Promise<OpenedTab> {
  return await invokeEF<OpenedTab>(client, "consumer-web-open-tab", {
    place_id: placeId,
  });
}

/** A saved card the tab can charge (on the guest's own Stripe customer). */
export type TabCard = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
};

/** What Stripe.js needs to finish a card part: a bank check (3-D Secure)
 *  runs `handleNextAction` on the place's account. */
export type TabCardStep = {
  status: "succeeded" | "processing" | "requires_action";
  payment_intent_id: string;
  client_secret?: string;
  stripe_account?: string;
  publishable_key?: string;
};

export type TabRead = {
  tab: GuestTab;
  /** Only when asked (`withCards`) and the place takes cards. */
  cards?: TabCard[];
  /** A card part waiting on the guest (a bank check left open, a reload). */
  card_action?: TabCardStep;
  /** A card part that just failed; the tab is billed again. */
  card_error?: { code: string; error: string; decline_code?: string };
};

export async function apiGetTab(
  client: SupabaseClient,
  tabId: string,
  opts: { withCards?: boolean } = {},
): Promise<TabRead> {
  return await invokeEF<TabRead>(client, "consumer-web-get-tab", {
    tab_id: tabId,
    ...(opts.withCards ? { with_cards: true } : {}),
  });
}

export type TabSplit = {
  credit_cents: number;
  cash_bill_cents: number;
  cash_tip_cents: number;
  card_bill_cents: number;
  card_tip_cents: number;
};

/** One tap. `request_id` is one per tap; a retry after a lost answer sends
 *  the same, so it never pays (or charges the card) twice. A card part needs
 *  `card_pm_id`. Refusals arrive as EFError codes: stale, insufficient,
 *  outside_limit, card_declined, card_needs_auth, card_tip_alone, … */
export async function apiPayTab(
  client: SupabaseClient,
  args: {
    tab_id: string;
    bill_version: number;
    request_id: string;
    card_pm_id?: string | null;
  } & TabSplit,
): Promise<{ status: "paying" | "paid"; card?: TabCardStep }> {
  const { card_pm_id, ...rest } = args;
  const hasCard = rest.card_bill_cents > 0 || rest.card_tip_cents > 0;
  return await invokeEF<{ status: "paying" | "paid"; card?: TabCardStep }>(
    client,
    "consumer-web-pay-tab",
    {
      ...rest,
      ...(hasCard && card_pm_id ? { card_pm_id } : {}),
    },
  );
}

/** The card part's bank check (3-D Secure), in Stripe.js on the place's
 *  account. Loaded only here, only when a card asks for it. "done": Stripe
 *  finished the step (the poll reads whether it went through, and says so
 *  when the bank refused); "unavailable": the check couldn't open. */
export async function runBankCheck(
  step: TabCardStep,
): Promise<"done" | "unavailable"> {
  if (!step.client_secret || !step.publishable_key || !step.stripe_account)
    return "unavailable";
  try {
    const { loadStripe } = await import("@stripe/stripe-js");
    const stripe = await loadStripe(step.publishable_key, {
      stripeAccount: step.stripe_account,
    });
    if (!stripe) return "unavailable";
    await stripe.handleNextAction({ clientSecret: step.client_secret });
    return "done";
  } catch {
    return "unavailable";
  }
}

/** "cancel" closes the tab before paying; "change" undoes a cash choice
 *  before the waiter's Received and frees the credit it held. */
export async function apiCancelTab(
  client: SupabaseClient,
  tabId: string,
  mode: "cancel" | "change",
): Promise<void> {
  await invokeEF(client, "consumer-web-cancel-tab", { tab_id: tabId, mode });
}

export type PayWith = "cash" | "card";

/** How the screen splits a bill: the guest's credit first (up to the bill)
 *  when they use it, the rest of the bill in cash or by card, the whole tip
 *  in cash or by card (credits never pay a tip). Cashback is the place's
 *  rate on the cash bill part (2%) plus the card rate on the card bill part
 *  (5%), never on credit or the tip; the server may give less (its daily
 *  cap). `card_tip_alone`: a card tip needs part of the bill by card or
 *  credits (the server refuses it otherwise). */
export function tabSplit(args: {
  billCents: number;
  tipCents: number;
  spendableCents: number;
  useCredit: boolean;
  cashBackBps: number;
  billWith?: PayWith;
  tipWith?: PayWith;
  cardBackBps?: number;
}): TabSplit & {
  total_cents: number;
  cash_due_cents: number;
  card_due_cents: number;
  cashback_cents: number;
  card_tip_alone: boolean;
} {
  const bill = Math.max(0, Math.round(args.billCents));
  const tip = Math.max(0, Math.round(args.tipCents));
  const credit = args.useCredit
    ? Math.min(Math.max(0, args.spendableCents), bill)
    : 0;
  const rest = bill - credit;
  const cardBill = args.billWith === "card" ? rest : 0;
  const cashBill = rest - cardBill;
  const cardTip = args.tipWith === "card" ? tip : 0;
  const cashTip = tip - cardTip;
  return {
    credit_cents: credit,
    cash_bill_cents: cashBill,
    cash_tip_cents: cashTip,
    card_bill_cents: cardBill,
    card_tip_cents: cardTip,
    total_cents: bill + tip,
    cash_due_cents: cashBill + cashTip,
    card_due_cents: cardBill + cardTip,
    cashback_cents:
      Math.floor((cashBill * Math.max(0, args.cashBackBps)) / 10_000) +
      Math.floor((cardBill * Math.max(0, args.cardBackBps ?? 0)) / 10_000),
    card_tip_alone: cardTip > 0 && cardBill === 0 && credit === 0,
  };
}

/** What the guest reads when a tap is refused, by the server's code. */
export const TAB_REFUSAL: Record<string, string> = {
  stale: "The bill changed. Check it and pay again.",
  insufficient: "Your credit changed. Check it and pay again.",
  outside_limit:
    "You've paid the waiter in cash here enough times today. Use your credit instead.",
  not_billed: "The waiter hasn't sent the bill yet.",
  paying: "You're already paying this bill.",
  paid: "This bill is paid.",
  expired: "This bill expired. Open a new one.",
  cancelled: "This bill was cancelled.",
  card_unavailable:
    "This place isn't taking cards right now. Pay with credits or cash.",
  cards_off:
    "This place isn't taking cards right now. Pay with credits or cash.",
  no_account:
    "This place isn't taking cards right now. Pay with credits or cash.",
  currency_mismatch:
    "This place isn't taking cards right now. Pay with credits or cash.",
  card_declined: "Your card was declined. Try another card or pay another way.",
  card_needs_auth:
    "This card needs a bank check we can't do yet. Pick another way to pay.",
  card_failed: "Couldn't start the card payment. Try again.",
  card_tip_alone: "A tip by card needs part of the bill by card or credit.",
  below_minimum: "The card part is too small for a card. Pay it another way.",
  card_not_found:
    "That card isn't saved on your account anymore. Pick another.",
  card_required: "Pick a card.",
  card_pending: "Your card is still going through.",
  locked: "Too many card tries. Wait a few minutes or pay another way.",
  closed: "That payment was cancelled. Tap again to start over.",
  parts: "The amounts don't add up to the bill. Check it and pay again.",
};

/** One of the guest's visits, as consumer-web-list-visits answers it
 *  (MESITA-3688, Activity › Visits). `status` is already the effective one
 *  (an open tab past its time reads expired). */
export type GuestVisit = {
  tab_id: string;
  place: {
    id: string;
    name: string | null;
    slug: string | null;
    photo_url: string | null;
  };
  status: TabStatus;
  currency: string;
  bill_cents: number | null;
  tip_cents: number;
  ticket: string | null;
  waiter_name: string | null;
  created_at: string;
  paid_at: string | null;
  expires_at: string;
  /** Every payment of this tab, any status: Payments leaves these to Visits. */
  part_payment_ids: string[];
};

export async function apiListVisits(
  client: SupabaseClient,
): Promise<{ visits: GuestVisit[]; truncated: boolean }> {
  return await invokeEF<{ visits: GuestVisit[]; truncated: boolean }>(
    client,
    "consumer-web-list-visits",
    {},
    "Couldn't load your visits",
  );
}
