// Pay at the table, the guest's side (MESITA-3564). The guest opens a tab at
// a place and shows its QR; the waiter types the bill and a tip suggestion on
// visit.mesita.ai; the guest pays the bill with credits first and the rest in
// cash (or on the place's own terminal), and the tip in cash (credits never
// pay a tip); a cash part waits for the waiter's Received. MESITA-4708: no
// card part for a bill (cards, MESITA-3572, and Apple Pay / Google Pay,
// MESITA-4386, are gone): cards buy vouchers only. The server is the last word
// on every amount; tabSplit is only what the screen proposes.

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
  /** MESITA-4708: cash only; a bill has no card part. */
  rates: { cash_available: boolean };
  credit_cents: number;
  cash_bill_cents: number;
  cash_tip_cents: number;
  cash_due_cents: number;
  cash_received_cents: number | null;
  /** 0 since MESITA-4708 (no card part); an older bill may carry one. */
  card_bill_cents: number;
  card_tip_cents: number;
  /** The payment rows the guest's split opened: `outside` (cash); `card` on
   *  an older bill. */
  parts: Array<{
    id: string;
    part: string | null;
    status: string;
    paid_at: string | null;
    /** MESITA-3780: what this part charged. Older reads have none. */
    created_at?: string;
    credit_cents?: number;
    cash_cents?: number;
    card_cents?: number;
    tip_cents?: number;
    /** MESITA-3856: when the bank held this card for the waiter. */
    held_at?: string | null;
    /** MESITA-4386: express | apple_pay | google_pay on an express card part. */
    pay_with?: string | null;
  }>;
  /** MESITA-3780: the timeline. Older reads have none. */
  created_at?: string | null;
  billed_at?: string | null;
  paying_at?: string | null;
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
  /** MESITA-3861: why a guest bill ended unpaid (cancelled, rejected,
   *  expired, capture_failed), and the card being charged at the signature. */
  end_reason?: string | null;
  signing?: boolean;
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

/** What Stripe.js needs to finish a card payment: a bank check (3-D Secure)
 *  runs `handleNextAction` on the place's account. MESITA-4708: a voucher
 *  bought with a saved card (member-place-actions); never a bill. */
export type TabCardStep = {
  status: "succeeded" | "processing" | "requires_action";
  payment_intent_id: string;
  client_secret?: string;
  stripe_account?: string;
  publishable_key?: string;
};

export type TabRead = {
  tab: GuestTab;
  /** MESITA-4747: the Back this paid bill earned (its cashback lines
   *  summed), Pending until `available_at` (paid + 1 hour); null when it
   *  earned none. Absent from a server before MESITA-4747. */
  back?: { amount_cents: number; currency: string; available_at: string | null; pending: boolean } | null;
  /** MESITA-3709: a new QR for a guest tab, only when asked (`remint`). */
  token?: string;
  qr_url?: string;
};

export async function apiGetTab(
  client: SupabaseClient,
  tabId: string,
  opts: { remint?: boolean } = {},
): Promise<TabRead> {
  return await invokeEF<TabRead>(client, "consumer-web-get-tab", {
    tab_id: tabId,
    ...(opts.remint ? { remint: true } : {}),
  });
}

/** MESITA-3709: the guest's own payment, in one tap. The guest typed the
 *  bill (before tip) and chose how to pay it (credits, the rest in cash); the
 *  answer is the guest tab and its QR (the waiter scans it to Verify). One
 *  `request_id` per tap: a retry after a lost answer sends the
 *  same and gets the same tab. Refusals arrive as EFError codes. */
export type PaidGuest = {
  outcome: "opened" | "replayed";
  tab_id: string | null;
  status: "paying" | "paid" | "due";
  token: string;
  qr_url: string;
  expires_at: string | null;
  test_mode: boolean;
};

export async function apiReleaseGuestPay(client: SupabaseClient, requestId: string): Promise<void> {
  await invokeEF(client, "consumer-web-pay-guest", { release: true, request_id: requestId });
}

export async function apiPayGuest(
  client: SupabaseClient,
  args: { place_id: string; bill_cents: number; request_id: string } & TabSplit,
): Promise<PaidGuest> {
  return await invokeEF<PaidGuest>(client, "consumer-web-pay-guest", args);
}

export type TabSplit = {
  credit_cents: number;
  cash_bill_cents: number;
  cash_tip_cents: number;
};

/** One tap. `request_id` is one per tap; a retry after a lost answer sends
 *  the same, so it never pays twice. Refusals arrive as EFError codes:
 *  stale, insufficient, outside_limit, cash_off, … */
export async function apiPayTab(
  client: SupabaseClient,
  args: {
    tab_id: string;
    bill_version: number;
    request_id: string;
  } & TabSplit,
): Promise<{ status: "paying" | "paid" }> {
  return await invokeEF<{ status: "paying" | "paid" }>(client, "consumer-web-pay-tab", args);
}

/** A card's bank check (3-D Secure), in Stripe.js on the place's account
 *  (a voucher bought with a saved card). Loaded only here, only when a card
 *  asks for it. "done": Stripe
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
 *  signed (it ends now). A signed one is refused. */
export async function apiCancelTab(
  client: SupabaseClient,
  tabId: string,
  /** "close" ends a guest payment whose money moved, unsigned (MESITA-3772). */
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

/** How the rest of a bill is paid: outside the app, in cash or on the
 *  place's own terminal (MESITA-4708: the card way is gone). */
export type PayWith = "cash";

/** How the screen splits a bill: the guest's credit first (up to the bill)
 *  when they use it, the rest of the bill and the whole tip in cash (credits
 *  never pay a tip). */
export function tabSplit(args: {
  billCents: number;
  tipCents: number;
  spendableCents: number;
  useCredit: boolean;
}): TabSplit & {
  total_cents: number;
  cash_due_cents: number;
} {
  const bill = Math.max(0, Math.round(args.billCents));
  const tip = Math.max(0, Math.round(args.tipCents));
  const credit = args.useCredit
    ? Math.min(Math.max(0, args.spendableCents), bill)
    : 0;
  const cashBill = bill - credit;
  return {
    credit_cents: credit,
    cash_bill_cents: cashBill,
    cash_tip_cents: tip,
    total_cents: bill + tip,
    cash_due_cents: cashBill + tip,
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
  // MESITA-4708: a bill has no card part.
  cards_off: "Pay the rest with cash or the place's own terminal.",
  closed: "That payment was cancelled. Tap again to start over.",
  // MESITA-3709: guest pays, waiter verifies.
  // MESITA-3772: one open payment per guest, across every place.
  too_many_open: "Get your open payment signed or close it before paying again.",
  amount_required: "Type the amount you're paying.",
  cash_off: "This place doesn't take cash through Mesita. Pay with credit.",
  above_cap: "That's more than Mesita takes in one payment.",
  verified: SIGN.alreadySigned,
  guest_tab: "This payment can only be cancelled.",
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
  /** MESITA-3772: who opened it (`guest` = the guest paid it themselves) and
   *  when the waiter signed it. Older reads have neither. */
  origin?: "guest" | "waiter";
  verified_at?: string | null;
};

export async function apiListVisits(
  client: SupabaseClient,
  /** MESITA-4595: the next 50, created before this instant. */
  before?: string,
): Promise<{ visits: GuestVisit[]; truncated: boolean }> {
  return await invokeEF<{ visits: GuestVisit[]; truncated: boolean }>(
    client,
    "consumer-web-list-visits",
    before ? { before } : {},
    "Couldn't load your visits",
  );
}
