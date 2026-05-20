// Frontend API surface for the guest-facing ticket / cashback / story EFs.
//
// Same constraints as api/venues.ts: clients call exactly one Edge Function
// per helper; helpers never compose multiple Edge Functions. Manager- and
// validator-side helpers (create/cancel/verify/mark-paid/lookup) live in
// the manager app's tree — guest never invokes them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

// ─── Guest profile ───────────────────────────────────────────────────────

export type GuestProfile = {
  id: string;
  code: string;
  full_name: string | null;
  sex: string | null;
  birthday: string | null;
  country: string | null;
  phone: string | null;
  cashback_balance_cents: number;
};

type GuestOnboardingInput = {
  full_name: string;
  sex: "male" | "female" | "other";
  birthday: string; // YYYY-MM-DD
  country: string;
  // Optional — phone is the auth identity and lives on auth.user.phone.
  // guest-update-profile mirrors it into guests.phone on first call.
  phone?: string;
};

export async function apiUpdateGuestProfile(
  client: SupabaseClient,
  input: GuestOnboardingInput,
): Promise<GuestProfile> {
  const { guest } = await invokeEF<{ guest: GuestProfile }>(
    client,
    "guest-update-profile",
    input,
  );
  return guest;
}

export async function apiFetchGuestProfile(
  client: SupabaseClient,
): Promise<GuestProfile> {
  const { guest } = await invokeEF<{ guest: GuestProfile }>(
    client,
    "guest-get-profile",
    {},
  );
  return guest;
}

// ─── Ticket taxonomy ─────────────────────────────────────────────────────

// All 10 kinds from the spec. `none` means "no Mesita transaction" —
// kept here for typing completeness but never persisted to the table.
type TicketKind =
  | "none"
  | "p_c"
  | "s_p_sf_c"
  | "r_p_c"
  | "r_s_p_sf_c"
  | "dp"
  | "s_dp_sf"
  | "r_dp"
  | "r_s_dp_sf";

type TicketStatus =
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

type ReservationStatus =
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

export type GuestTicket = Ticket & {
  venue: {
    id: string;
    name: string;
    slug: string;
    photos: string[];
    fiscal_type?: FiscalType;
  } | null;
};

// ─── Reads + writes (guest-side only) ────────────────────────────────────

export async function apiFetchMyTickets(
  client: SupabaseClient,
  limit = 20,
): Promise<GuestTicket[]> {
  const { tickets } = await invokeEF<{ tickets: GuestTicket[] }>(
    client,
    "guest-list-tickets",
    { limit },
  );
  return tickets;
}

export async function apiSubmitStory(
  client: SupabaseClient,
  input: { ticketId: string; screenshotUrl: string },
): Promise<Ticket> {
  const { ticket } = await invokeEF<{
    ticket: Ticket;
    alreadyVerified?: boolean;
  }>(client, "guest-submit-story", input);
  return ticket;
}

// ─── Step timeline (drives the guest's progress card) ────────────────────

export type WorkflowStep = {
  id: string;
  title: string;
  sub: string;
  forClarity?: boolean;
  done: boolean;
  current: boolean;
};

/**
 * Build the step timeline for a single ticket so the guest can see exactly
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
    done: revealed || paid || awaitingStory,
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
    done: revealed || paid || awaitingStory,
  });

  steps.push({
    id: "show-qr",
    title: "Show your QR to waiter",
    sub: "Open this ticket and show your personal QR code.",
    done: revealed || paid || awaitingStory,
  });

  steps.push({
    id: "validate-qr",
    title: "Waiter validates QR",
    sub: isFormal
      ? "The waiter scans your QR and enters your bill total + tip."
      : "The waiter scans your QR. The discount is revealed and applied to the bill.",
    done: revealed || paid || awaitingStory,
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
      done: revealed || paid || awaitingStory,
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

  // Mark the first not-done step as the current one.
  const out: WorkflowStep[] = [];
  let currentAssigned = false;
  for (const s of steps) {
    out.push({
      ...s,
      current: !currentAssigned && !s.done ? true : false,
    });
    if (!currentAssigned && !s.done) currentAssigned = true;
  }
  return out;
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
