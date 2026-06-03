import type { Database } from "@/lib/supabase/database.types";

export type TicketKind = Database["public"]["Enums"]["ticket_kind"];
export type TicketStatus = Database["public"]["Enums"]["ticket_status"];
export type StoryStatus = Database["public"]["Enums"]["story_status"];

export type TicketFlowType = "A" | "B" | "C" | "D";

export type TicketFlowStepId =
  | "scan"
  | "bill"
  | "story_fallback"
  | "pay"
  | "pay_stripe"
  | "review"
  | "cashback";

export type TicketFlowStepState = "done" | "active" | "upcoming";

export type TicketFlowStepView = {
  id: TicketFlowStepId;
  label: string;
  state: TicketFlowStepState;
};

export type TicketProgressInput = {
  kind: TicketKind | string;
  status: TicketStatus | string;
  story_status: StoryStatus | string;
  story_submitted_at?: string | null;
  total_cents?: number | null;
  consumer_payment_confirmed_at?: string | null;
  paymentNotificationPending: boolean;
  reviewNotificationPending: boolean;
  reviewCompleted: boolean;
};

const STORY_VERIFIED = new Set<StoryStatus>(["ai_verified", "waiter_verified"]);

const FORMAL_KINDS = new Set(["p_c", "s_p_sf_c", "r_p_c", "r_s_p_sf_c"]);
const STORY_KINDS = new Set(["s_p_sf_c", "r_s_p_sf_c", "s_dp_sf", "r_s_dp_sf"]);

/** Type A/B/C/D from ticket kind (reservation-prefixed kinds mirror base type). */
export function ticketFlowTypeFromKind(kind: string): TicketFlowType {
  if (kind === "dp" || kind === "r_dp") return "A";
  if (kind === "s_dp_sf" || kind === "r_s_dp_sf") return "B";
  if (kind === "p_c" || kind === "r_p_c") return "C";
  if (kind === "s_p_sf_c" || kind === "r_s_p_sf_c") return "D";
  if (FORMAL_KINDS.has(kind)) return STORY_KINDS.has(kind) ? "D" : "C";
  return STORY_KINDS.has(kind) ? "B" : "A";
}

/**
 * Consumer ticket milestones aligned to product sequences:
 *
 * - Scan → Billing → [Story] → Payment → [Cashback landing] → Review
 * - Type A: discount, no story
 * - Type B: discount + story before payment
 * - Type C: Stripe payment + cashback landing, no story
 * - Type D: story + Stripe payment + cashback landing
 */
export const FLOW_STEPS_BY_TYPE: Record<TicketFlowType, TicketFlowStepId[]> = {
  A: ["scan", "bill", "pay", "review"],
  B: ["scan", "bill", "story_fallback", "pay", "review"],
  C: ["scan", "bill", "pay_stripe", "cashback", "review"],
  D: ["scan", "bill", "story_fallback", "pay_stripe", "cashback", "review"],
};

export const STEP_LABELS: Record<TicketFlowStepId, string> = {
  scan: "Scan",
  bill: "Billing",
  story_fallback: "Story",
  pay: "Pay",
  pay_stripe: "Pay",
  cashback: "Cashback",
  review: "Review",
};

/** Consumer-facing copy for each product sequence step. */
export type StepSequenceLine =
  | string
  | { text: string; struck?: boolean };

export const STEP_SEQUENCE_DETAILS: Record<TicketFlowStepId, StepSequenceLine[]> = {
  scan: [
    "Show your Mesita QR at the table.",
    "Staff scans it to start your visit and reward.",
  ],
  bill: [
    "Your food & drink subtotal appears here.",
    "Your Mesita discount applies to the subtotal only.",
    "You'll see what to pay before the next step.",
  ],
  story_fallback: [
    "Post an Instagram story tagging Mesita and the venue.",
    {
      text: "Upload a screenshot in the Mesita app.",
      struck: true,
    },
    "We detect the tag automatically — no screenshot needed.",
    "Once verified, you can finish payment and claim your reward.",
  ],
  pay: [
    "Pay what you owe at the table.",
    "Tap confirm in Mesita when you're done.",
  ],
  pay_stripe: [
    "Open the secure payment link on your phone.",
    "Pay online — your reward applies after payment clears.",
  ],
  cashback: ["Cashback is added to your Mesita balance."],
  review: [
    "Rate food, service, ambiance, and overall.",
    "Add optional comments about your visit.",
  ],
};

/** One-line copy when a step is done or not yet open. */
export const STEP_SEQUENCE_SUMMARY: Record<
  TicketFlowStepId,
  { done: string; upcoming: string }
> = {
  scan: {
    done: "Your QR was scanned — visit started.",
    upcoming: "Show your Mesita QR so staff can start your visit.",
  },
  bill: {
    done: "Your subtotal and discount are ready.",
    upcoming: "Your subtotal will show up here.",
  },
  story_fallback: {
    done: "Your story was verified.",
    upcoming: "Post an IG story tagging Mesita and the venue.",
  },
  pay: {
    done: "Payment confirmed.",
    upcoming: "Pay at the table, then confirm in Mesita.",
  },
  pay_stripe: {
    done: "Paid online.",
    upcoming: "Pay with the secure link on your phone.",
  },
  cashback: {
    done: "Cashback added to your Mesita balance.",
    upcoming: "Cashback lands in your Mesita balance after payment.",
  },
  review: {
    done: "Thanks — your review was submitted.",
    upcoming: "Rate your visit when you're ready.",
  },
};

export function ticketFlowStepAnchorId(stepId: TicketFlowStepId): string {
  return `ticket-flow-step-${stepId}`;
}

export function ticketFlowStepStatusLabel(
  step: TicketFlowStepView,
): string {
  if (step.state === "done") return "Done";
  if (step.state === "active") return "Now";
  return "Pending";
}

function hasBill(input: TicketProgressInput): boolean {
  return input.total_cents != null && input.total_cents > 0;
}

function storyVerified(story_status: string): boolean {
  return STORY_VERIFIED.has(story_status as StoryStatus);
}

function discountPaid(input: TicketProgressInput): boolean {
  return (
    Boolean(input.consumer_payment_confirmed_at) ||
    input.status === "revealed"
  );
}

/** Stripe checkout completed (formal cashback types). */
function stripePaid(input: TicketProgressInput): boolean {
  return (
    input.status === "paid" ||
    input.status === "awaiting_story" ||
    input.status === "revealed"
  );
}

/** Cashback credited to Mesita balance. */
function cashbackLanded(input: TicketProgressInput): boolean {
  return input.status === "paid" || input.status === "revealed";
}

function reviewDone(input: TicketProgressInput): boolean {
  return input.reviewCompleted;
}

function inferCurrentIndex(
  flowType: TicketFlowType,
  steps: TicketFlowStepId[],
  input: TicketProgressInput,
): number {
  const idx = (id: TicketFlowStepId) => steps.indexOf(id);

  if (!hasBill(input)) return idx("scan");

  switch (flowType) {
    case "A": {
      if (discountPaid(input) && reviewDone(input)) return steps.length;
      if (discountPaid(input)) return idx("review");
      return idx("pay");
    }
    case "B": {
      if (discountPaid(input) && reviewDone(input)) return steps.length;
      if (discountPaid(input)) return idx("review");
      if (!storyVerified(input.story_status)) return idx("story_fallback");
      return idx("pay");
    }
    case "C": {
      if (reviewDone(input)) return steps.length;
      if (cashbackLanded(input)) return idx("review");
      if (stripePaid(input)) return idx("cashback");
      return idx("pay_stripe");
    }
    case "D": {
      if (reviewDone(input)) return steps.length;
      if (cashbackLanded(input)) return idx("review");
      if (stripePaid(input)) return idx("cashback");
      if (!storyVerified(input.story_status)) return idx("story_fallback");
      return idx("pay_stripe");
    }
    default:
      return idx("scan");
  }
}

export function resolveTicketFlowSteps(
  input: TicketProgressInput,
): TicketFlowStepView[] {
  const flowType = ticketFlowTypeFromKind(input.kind);
  const stepIds = FLOW_STEPS_BY_TYPE[flowType];
  const currentIndex = inferCurrentIndex(flowType, stepIds, input);

  return stepIds.map((id, index) => ({
    id,
    label: STEP_LABELS[id],
    state:
      index < currentIndex
        ? "done"
        : index === currentIndex
          ? "active"
          : "upcoming",
  }));
}

export function ticketProgressFromBundle(input: {
  kind?: string | null;
  status?: string | null;
  story_status?: string | null;
  story_submitted_at?: string | null;
  total_cents?: number | null;
  consumer_payment_confirmed_at?: string | null;
  payment?: { status: string } | null;
  review?: { status: string } | null;
}): TicketProgressInput {
  return {
    kind: input.kind ?? "dp",
    status: input.status ?? "awaiting_payment_confirm",
    story_status: input.story_status ?? "not_required",
    story_submitted_at: input.story_submitted_at ?? null,
    total_cents: input.total_cents ?? null,
    consumer_payment_confirmed_at: input.consumer_payment_confirmed_at ?? null,
    paymentNotificationPending: input.payment?.status === "pending",
    reviewNotificationPending: input.review?.status === "pending",
    reviewCompleted: input.review?.status === "completed",
  };
}

export function isTicketFlowComplete(input: TicketProgressInput): boolean {
  const flowType = ticketFlowTypeFromKind(input.kind);
  const stepIds = FLOW_STEPS_BY_TYPE[flowType];
  const currentIndex = inferCurrentIndex(flowType, stepIds, input);
  return currentIndex >= stepIds.length;
}
