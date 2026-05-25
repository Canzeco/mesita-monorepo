// Frontend API surface for ticket / cashback / discount / story Edge Functions.
//
// Same constraints as api/venues.ts: clients call exactly one Edge Function
// per helper; helpers never compose multiple Edge Functions.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

// ─── Consumer profile ───────────────────────────────────────────────────────

export type ConsumerProfile = {
  id: string;
  code: string;
  full_name: string | null;
  sex: string | null;
  birthday: string | null;
  country: string | null;
  phone: string | null;
  cashback_balance_cents: number;
};

export type ConsumerOnboardingInput = {
  full_name: string;
  sex: "male" | "female" | "other";
  birthday: string; // YYYY-MM-DD
  country: string;
  // Optional — phone is the auth identity and lives on auth.user.phone.
  // consumer-update-profile mirrors it into consumers.phone on first call.
  phone?: string;
};

export type ConsumerFullProfile = ConsumerProfile & {
  sex: string | null;
  birthday: string | null;
  country: string | null;
};

export async function apiUpdateConsumerProfile(
  client: SupabaseClient,
  input: ConsumerOnboardingInput,
): Promise<ConsumerFullProfile> {
  const { consumer } = await invokeEF<{ consumer: ConsumerFullProfile }>(
    client,
    "consumer-update-profile",
    input,
  );
  return consumer;
}

// Destructive: drops the caller's consumer row + every dependent ticket /
// cashback_ledger entry, plus the auth.users row so the email can
// re-sign-up clean. Caller's session ends — the client should sign out
// and redirect to the sign-in page after.
export async function apiDeleteConsumerAccount(
  client: SupabaseClient,
): Promise<{ id: string }> {
  return await invokeEF<{ id: string }>(client, "consumer-delete-account", {});
}

// ─── Ticket taxonomy ─────────────────────────────────────────────────────

// All 10 kinds from the spec. `none` means "no Mesita transaction" —
// kept here for typing completeness but never persisted to the table.
export type TicketKind =
  | "none"
  | "p_c"
  | "s_p_sf_c"
  | "r_p_c"
  | "r_s_p_sf_c"
  | "dp"
  | "s_dp_sf"
  | "r_dp"
  | "r_s_dp_sf";

export type TicketStatus =
  | "open"
  | "pending_pay"
  | "awaiting_story"
  | "paid"
  | "revealed"
  | "cancelled";

export type StoryStatus =
  | "not_required"
  | "pending"
  | "submitted"
  | "ai_verified"
  | "ai_rejected"
  | "waiter_verified"
  | "waiter_rejected";

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "no_show"
  | "cancelled";

export type FiscalType = "formal" | "informal";

const FORMAL_KINDS: ReadonlySet<TicketKind> = new Set([
  "p_c",
  "s_p_sf_c",
  "r_p_c",
  "r_s_p_sf_c",
]);
const STORY_KINDS: ReadonlySet<TicketKind> = new Set([
  "s_p_sf_c",
  "r_s_p_sf_c",
  "s_dp_sf",
  "r_s_dp_sf",
]);
const RESERVATION_KINDS: ReadonlySet<TicketKind> = new Set([
  "r_p_c",
  "r_s_p_sf_c",
  "r_dp",
  "r_s_dp_sf",
]);

// Human-readable label per kind. Kept here so both validator + consumer views
// share the same vocabulary.
export const KIND_LABEL: Record<TicketKind, string> = {
  none: "No transaction",
  p_c: "Payment → Cashback",
  s_p_sf_c: "Story → Payment → Cashback",
  r_p_c: "Reservation → Payment → Cashback",
  r_s_p_sf_c: "Reservation → Story → Payment → Cashback",
  dp: "Discounted payment",
  s_dp_sf: "Story → Discounted payment",
  r_dp: "Reservation → Discounted payment",
  r_s_dp_sf: "Reservation → Story → Discounted payment",
};

export function ticketIsFormal(kind: TicketKind): boolean {
  return FORMAL_KINDS.has(kind);
}
export function ticketRequiresStory(kind: TicketKind): boolean {
  return STORY_KINDS.has(kind);
}
export function ticketHasReservation(kind: TicketKind): boolean {
  return RESERVATION_KINDS.has(kind);
}

// ─── Ticket shape ────────────────────────────────────────────────────────

export type Ticket = {
  id: string;
  kind: TicketKind;
  status: TicketStatus;
  story_status: StoryStatus;
  story_screenshot_url?: string | null;
  story_submitted_at?: string | null;
  story_verified_at?: string | null;
  story_reject_reason?: string | null;
  check_subtotal_cents: number | null;
  tip_cents: number | null;
  total_cents: number | null;
  cashback_percent: number;
  cashback_cents: number | null;
  redeem_cents: number | null;
  discount_percent?: number | null;
  discount_cents?: number | null;
  revealed_at?: string | null;
  reservation_status?: ReservationStatus | null;
  reservation_at?: string | null;
  reservation_party_size?: number | null;
  currency: string;
  created_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  cancel_reason?: string | null;
};

export type ConsumerTicket = Ticket & {
  venue: {
    id: string;
    name: string;
    slug: string;
    photos: string[];
    fiscal_type?: FiscalType;
  } | null;
};

export type VenueTicket = Ticket & {
  consumer: { id: string; code: string; full_name: string | null } | null;
};

// ─── Reads ───────────────────────────────────────────────────────────────

export async function apiFetchConsumerProfile(
  client: SupabaseClient,
): Promise<ConsumerProfile> {
  const { consumer } = await invokeEF<{ consumer: ConsumerProfile }>(
    client,
    "consumer-get-profile",
    {},
  );
  return consumer;
}

export async function apiFetchMyTickets(
  client: SupabaseClient,
  limit = 20,
): Promise<ConsumerTicket[]> {
  const { tickets } = await invokeEF<{ tickets: ConsumerTicket[] }>(
    client,
    "consumer-list-tickets",
    { limit },
  );
  return tickets;
}

export async function apiFetchVenueTickets(
  client: SupabaseClient,
  venueId: string,
  limit = 20,
): Promise<VenueTicket[]> {
  const { tickets } = await invokeEF<{ tickets: VenueTicket[] }>(
    client,
    "manager-list-tickets",
    { venueId, limit },
  );
  return tickets;
}

// ─── Writes ──────────────────────────────────────────────────────────────

export type CreateTicketInput = {
  venueId: string;
  consumerCode: string;
  kind: TicketKind;
  checkSubtotalCents: number;
  tipCents: number;
  /** Only used on formal kinds. Capped server-side at min(balance, total). */
  redeemCents?: number;
  /** Reservation fields (R-prefixed kinds). All optional today; the AI agent
   *  layer will populate them once it's live. */
  reservationAt?: string;
  reservationPartySize?: number;
  reservationChannel?:
    | "voice"
    | "whatsapp"
    | "instagram_dm"
    | "web_form"
    | "email";
  reservationNotes?: string;
};

type CreateTicketPayload = {
  ticket: Ticket;
  venue: { id: string; name: string; fiscal_type: FiscalType };
  consumer: { id: string; code: string; full_name: string | null };
};

export async function apiCreateTicket(
  client: SupabaseClient,
  input: CreateTicketInput,
): Promise<CreateTicketPayload> {
  return invokeEF<CreateTicketPayload>(client, "manager-create-ticket", input);
}

export type MarkPaidTicket = {
  id: string;
  status: TicketStatus;
  paid_at: string | null;
  cashback_cents: number | null;
  story_status?: StoryStatus;
};

export type MarkPaidResult = {
  ticket: MarkPaidTicket;
  cashbackCreditedCents: number;
  cashbackRedeemedCents: number;
  consumerBalanceAfterCents: number | null;
  alreadyPaid: boolean;
  awaitingStory: boolean;
};

// EF response — fields above marked optional get normalised to required
// defaults before returning so callers don't need to handle undefined.
type MarkPaidPayload = {
  ticket: MarkPaidTicket;
  cashbackCreditedCents: number;
  cashbackRedeemedCents?: number;
  consumerBalanceAfterCents: number | null;
  alreadyPaid?: boolean;
  awaitingStory?: boolean;
};

export async function apiMarkTicketPaid(
  client: SupabaseClient,
  ticketId: string,
): Promise<MarkPaidResult> {
  const data = await invokeEF<MarkPaidPayload>(client, "manager-mark-paid", {
    ticketId,
  });
  return {
    ticket: data.ticket,
    cashbackCreditedCents: data.cashbackCreditedCents,
    cashbackRedeemedCents: data.cashbackRedeemedCents ?? 0,
    consumerBalanceAfterCents: data.consumerBalanceAfterCents,
    alreadyPaid: data.alreadyPaid ?? false,
    awaitingStory: data.awaitingStory ?? false,
  };
}

export type ConsumerLookupResult = {
  id: string;
  code: string;
  full_name: string | null;
  cashback_balance_cents: number;
};

export async function apiLookupConsumer(
  client: SupabaseClient,
  code: string,
): Promise<ConsumerLookupResult> {
  const { consumer } = await invokeEF<{ consumer: ConsumerLookupResult }>(
    client,
    "manager-find-consumer",
    { code },
  );
  return consumer;
}

export async function apiCancelTicket(
  client: SupabaseClient,
  ticketId: string,
  reason?: string,
): Promise<void> {
  await invokeEF(client, "manager-cancel-ticket", { ticketId, reason });
}

export type VerifyStoryInput = {
  ticketId: string;
  decision: "approve" | "reject";
  reason?: string;
};

export type VerifyStoryResult = {
  ticket: Ticket;
  cashbackCreditedCents: number;
  cashbackRedeemedCents: number;
  consumerBalanceAfterCents: number | null;
};

// EF response widens VerifyStoryResult with an idempotency flag we drop
// before returning — callers don't need it.
type VerifyStoryPayload = VerifyStoryResult & { alreadyDecided?: boolean };

export async function apiVerifyStory(
  client: SupabaseClient,
  input: VerifyStoryInput,
): Promise<VerifyStoryResult> {
  const data = await invokeEF<VerifyStoryPayload>(
    client,
    "manager-verify-story",
    input,
  );
  return {
    ticket: data.ticket,
    cashbackCreditedCents: data.cashbackCreditedCents,
    cashbackRedeemedCents: data.cashbackRedeemedCents,
    consumerBalanceAfterCents: data.consumerBalanceAfterCents,
  };
}

export type SubmitStoryInput = { ticketId: string; screenshotUrl: string };

type SubmitStoryPayload = { ticket: Ticket; alreadyVerified?: boolean };

export async function apiSubmitStory(
  client: SupabaseClient,
  input: SubmitStoryInput,
): Promise<Ticket> {
  const { ticket } = await invokeEF<SubmitStoryPayload>(
    client,
    "consumer-submit-story",
    input,
  );
  return ticket;
}

// ─── Step timeline (drives the consumer's progress card) ────────────────────

export type WorkflowStep = {
  id: string;
  title: string;
  sub: string;
  forClarity?: boolean;
  done: boolean;
  current: boolean;
};

/**
 * Build the step timeline for a single ticket so the consumer can see exactly
 * where the flow is. Pure function: no side effects, no fetches — the caller
 * passes the already-fetched ticket. The 10-type taxonomy maps onto this
 * helper one-to-one, so adding/removing a kind only touches this file.
 */
export function workflowSteps(ticket: Ticket): WorkflowStep[] {
  const k = ticket.kind;
  const isFormal = ticketIsFormal(k);
  const requiresStory = ticketRequiresStory(k);
  const hasReservation = ticketHasReservation(k);

  // Lifecycle pivots — these drive which steps are "done" vs "current".
  const paid = ticket.status === "paid";
  const awaitingStory = ticket.status === "awaiting_story";
  const revealed = ticket.status === "revealed" || ticket.status === "paid";
  const cancelled = ticket.status === "cancelled";
  // The waiter-side flow has officially started — everything from "arrive"
  // through "validate-qr" is locked in once any of these are true.
  const visitDone = revealed || paid || awaitingStory;
  const storyVerified =
    ticket.story_status === "ai_verified" ||
    ticket.story_status === "waiter_verified";
  const storyRejected = ticket.story_status === "waiter_rejected";
  const storySubmitted = ticket.story_status === "submitted";
  const reservationConfirmed = ticket.reservation_status === "confirmed";

  type Step = Omit<WorkflowStep, "current"> & { current?: boolean };
  const steps: Step[] = [];

  if (hasReservation) {
    steps.push({
      id: "reservation",
      title: reservationConfirmed
        ? "Reservation confirmed"
        : "Booking reservation",
      sub: reservationConfirmed
        ? "Your table is locked in."
        : "We're contacting the venue to lock in your spot.",
      done: reservationConfirmed,
    });
  }

  steps.push({
    id: "arrive",
    title: "Arrive & enjoy",
    sub: "Show up and enjoy your visit as usual.",
    forClarity: true,
    done: visitDone,
  });

  if (requiresStory) {
    steps.push({
      id: "story-prepay",
      title: "Post story & submit screenshot",
      sub: "Post an Instagram story tagging the venue, then upload a screenshot. Keep it real — show the food, drinks, or the place.",
      done: storySubmitted || storyVerified || storyRejected,
    });
  }

  steps.push({
    id: "bill",
    title: "Ask for the bill",
    sub: "When you're ready to leave, ask the waiter for your bill.",
    forClarity: true,
    done: visitDone,
  });

  steps.push({
    id: "show-qr",
    title: "Show your QR to waiter",
    sub: "Open this ticket and show your personal QR code.",
    done: visitDone,
  });

  steps.push({
    id: "validate-qr",
    title: "Waiter validates QR",
    sub: isFormal
      ? "The waiter scans your QR and enters your bill total + tip."
      : "The waiter scans your QR. The discount is revealed and applied to the bill.",
    done: visitDone,
  });

  if (isFormal) {
    steps.push({
      id: "pay",
      title: "Pay from your phone",
      sub: "We send a secure payment link. Pay in a couple of taps.",
      done: paid || awaitingStory,
    });
  } else {
    steps.push({
      id: "pay-cash",
      title: "Pay the bill in cash",
      sub: "Discount is already applied to the total.",
      done: visitDone,
    });
  }

  if (requiresStory) {
    steps.push({
      id: "story-postpay",
      title: "Story tag verified",
      sub: storyVerified
        ? "We confirmed your story tagged the venue."
        : storyRejected
          ? "The story couldn't be verified by the waiter."
          : storySubmitted
            ? "Verifying your screenshot…"
            : "Haven't posted yet? Post your story tagging the venue and upload the screenshot.",
      done: storyVerified,
    });
  }

  if (isFormal) {
    steps.push({
      id: "cashback",
      title: "Cashback lands",
      sub: requiresStory
        ? "Added once both payment and story are confirmed. No story, no cashback."
        : "Cashback lands in your Mesita balance once payment clears.",
      done: paid && (!requiresStory || storyVerified),
    });
  }

  if (cancelled) {
    return [
      {
        id: "cancelled",
        title: "Ticket cancelled",
        sub: ticket.cancel_reason ?? "Validator cancelled this ticket.",
        done: true,
        current: false,
      },
    ];
  }

  // Mark the first not-done step as the current one (findIndex returns
  // -1 when every step is done, which collapses to no `current` step).
  const currentIdx = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => ({ ...s, current: i === currentIdx }));
}

// ─── Display helpers ─────────────────────────────────────────────────────

export function formatCurrency(
  cents: number | null | undefined,
  currency = "MXN",
): string {
  if (cents == null) return "—";
  const value = cents / 100;
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value.toFixed(0)} ${currency}`;
  }
}
