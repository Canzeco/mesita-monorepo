// Pay at the table, the guest's side (MESITA-3564, cards MESITA-3572). The
// guest opens a tab at a place and shows its QR; the waiter types the bill
// and a tip suggestion on visit.mesita.ai; the guest chooses how to pay the
// bill (credits first, the rest in cash or by card) and the tip (cash or
// card; credits never pay a tip); a card part is charged inside the app on
// the place's Stripe account (a bank check, 3-D Secure, runs in Stripe.js);
// a cash part waits for the waiter's Received. The server is the last word on
// every amount; tabSplit is only what the screen proposes.

import type { SupabaseClient } from "@supabase/supabase-js";
import { SIGN } from "@mesita/place-profile/lib/pay-steps";
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
  /** The cashback actually granted so far. */
  cashback_cents: number;
  /** MESITA-3772: what the waiter's signature would earn now, card and cash
   *  (cashback turns on only when the waiter signs). Older reads have none. */
  cashback_on_sign_cents?: number;
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
  /** MESITA-3695: on a share, its table; on a split table, the table. */
  table: TabTable | null;
  /** On a split table: the guest's own share (the app opens it). */
  my_share_tab_id: string | null;
  /** MESITA-3709: `guest` = the guest typed the bill and paid alone; it ends
   *  with the waiter's Verify. Older reads have none (a waiter tab). */
  origin?: "waiter" | "guest";
  verified_at?: string | null;
};

/** A table friends are splitting (MESITA-3695). Shares are listed by id,
 *  never by who holds them. */
export type TabTable = {
  tab_id: string;
  status: TabStatus;
  bill_cents: number;
  tip_suggested_cents: number;
  ways: number | null;
  paid_cents: number;
  /** Paying or paid: no longer free to take. */
  taken_cents: number;
  /** What a share may still pay. */
  left_cents: number;
  shares: Array<{ id: string; status: TabStatus; share_cents: number; tip_cents: number }>;
  /** This guest split it: only they can show the friends' QR. */
  mine: boolean;
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
  /** MESITA-3709: a new QR for a guest tab, only when asked (`remint`). */
  token?: string;
  qr_url?: string;
};

export async function apiGetTab(
  client: SupabaseClient,
  tabId: string,
  opts: { withCards?: boolean; remint?: boolean } = {},
): Promise<TabRead> {
  return await invokeEF<TabRead>(client, "consumer-web-get-tab", {
    tab_id: tabId,
    ...(opts.withCards ? { with_cards: true } : {}),
    ...(opts.remint ? { remint: true } : {}),
  });
}

/** MESITA-3709: the guest's own payment, in one tap. The guest typed the
 *  bill (before tip) and chose how to pay it; the answer is the guest tab,
 *  its QR (the waiter scans it to Verify) and, with a card part, Stripe's
 *  step. One `request_id` per tap: a retry after a lost answer sends the
 *  same and gets the same tab. Refusals arrive as EFError codes. */
export type PaidGuest = {
  outcome: "opened" | "replayed";
  tab_id: string;
  status: "paying" | "paid";
  token: string;
  qr_url: string;
  expires_at: string | null;
  test_mode: boolean;
  card?: TabCardStep;
};

/** The guest pays alone. `ticket` is the restaurant's ticket number as typed
 *  (null: "No ticket number"); `repeat_ok` is the guest's "Yes, my share"
 *  after `ticket_paid`, sent with the SAME request id (MESITA-3776). */
export async function apiPayGuest(
  client: SupabaseClient,
  args: {
    place_id: string;
    bill_cents: number;
    request_id: string;
    card_pm_id?: string | null;
    ticket: string | null;
    repeat_ok: boolean;
  } & TabSplit,
): Promise<PaidGuest> {
  const { card_pm_id, ...rest } = args;
  const hasCard = rest.card_bill_cents > 0 || rest.card_tip_cents > 0;
  return await invokeEF<PaidGuest>(client, "consumer-web-pay-guest", {
    ...rest,
    ...(hasCard && card_pm_id ? { card_pm_id } : {}),
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
 *  before the waiter's Received and frees the credit it held. On the guest's
 *  own payment (MESITA-3772) the answer says how it ended: "cancelled" when
 *  nothing had moved, "closed" when money moved and the waiter had not
 *  signed (it ends now with no cashback). A signed one is refused. */
export async function apiCancelTab(
  client: SupabaseClient,
  tabId: string,
  /** "close" ends a guest payment whose money moved, unsigned: no cashback (MESITA-3772). */
  mode: "cancel" | "change" | "close",
): Promise<{ outcome?: "cancelled" | "closed" }> {
  return await invokeEF<{ outcome?: "cancelled" | "closed" }>(client, "consumer-web-cancel-tab", { tab_id: tabId, mode });
}

/** Split the bill (MESITA-3695): `ways` and the guest's own share. The
 *  answer names the guest's share and a fresh join token for the friends'
 *  QR (each call rotates it; earlier QRs stop working, shares stay). */
export async function apiSplitTab(
  client: SupabaseClient,
  args: { tab_id: string; ways: number; share_cents: number },
): Promise<{ share_tab_id: string; join_token: string; left_cents: number | null }> {
  return await invokeEF(client, "consumer-web-split-tab", args);
}

/** Pay the whole bill again: only while no share is paying or paid. */
export async function apiUnsplitTab(client: SupabaseClient, tableId: string): Promise<void> {
  await invokeEF(client, "consumer-web-split-tab", { tab_id: tableId, whole: true });
}

/** A share's new amount, before paying; refused (share_too_big) past what
 *  is left. */
export async function apiSetShare(client: SupabaseClient, shareTabId: string, shareCents: number): Promise<void> {
  await invokeEF(client, "consumer-web-split-tab", { tab_id: shareTabId, share_cents: shareCents });
}

/** A friend scanned the table's QR: takes a share (or gets theirs back). */
export async function apiJoinTab(client: SupabaseClient, joinToken: string): Promise<{ share_tab_id: string; share_cents: number | null }> {
  return await invokeEF(client, "consumer-web-join-tab", { join_token: joinToken });
}

/** The friends' QR's address: the app's own join door. */
export function joinUrl(origin: string, joinToken: string): string {
  return `${origin}/pay/join/${encodeURIComponent(joinToken)}`;
}

/** The equal part of a bill split `ways` ways, rounded up to the peso. */
export function equalShare(billCents: number, ways: number): number {
  return Math.min(billCents, Math.ceil(billCents / ways / 100) * 100);
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
  // MESITA-3695: friends split one bill.
  split_locked: "Friends are splitting this bill. Pay your share.",
  share_too_big: "That's more than what's left of the bill.",
  nothing_left: "Nothing is left to pay on this bill.",
  table_closed: "This bill is closed. Ask the waiter.",
  paid_part: "A friend already paid part of this bill.",
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
  // MESITA-3709: guest pays, waiter verifies.
  // MESITA-3772: one open payment per guest, across every place.
  too_many_open: "Get your open payment signed or close it before paying again.",
  amount_required: "Type the amount you're paying.",
  cash_off: "This place doesn't take cash through Mesita. Pay with credit or card.",
  above_cap: "That's more than Mesita takes in one payment.",
  verified: SIGN.alreadySigned,
  guest_tab: "This payment can only be cancelled.",
  parts: "The amounts don't add up to the bill. Check it and pay again.",
  // MESITA-3776: the ticket number. ticket_paid and ticket_paid_by_you open
  // a dialog on the Pay step (TICKET); these lines are the fallback.
  ticket_invalid: "That ticket number isn't valid",
  ticket_paid: "This ticket already has a payment.",
  ticket_paid_by_you: "You already paid this ticket.",
};

/** The Ticket step's words (MESITA-3776): its refusals and the two dialogs
 *  on the Pay step. */
export const TICKET = {
  heading: "Ticket number",
  line: "From the top of your ticket",
  whereIsIt: "Where is it?",
  hasLetters: "Has letters?",
  numberPad: "Number pad",
  none: "No ticket number",
  invalid: "That ticket number isn't valid",
  label: (t: string) => `Ticket ${t}`,
  // ticket_paid: another guest paid this ticket (a share).
  shared: (t: string) => `Ticket ${t} already has a payment. Paying your share?`,
  yesShare: "Yes, my share",
  paying: "Paying…",
  change: "Change ticket",
  // ticket_paid_by_you: this guest already paid it.
  mine: (t: string) => `You already paid ticket ${t}`,
  seeIt: "See that payment",
} as const;

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
  /** MESITA-3772: who opened it (`guest` = the guest paid it themselves) and
   *  when the waiter signed it. Older reads have neither. */
  origin?: "guest" | "waiter";
  verified_at?: string | null;
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
