import type { Database } from "@/lib/supabase/database.types";

export type TicketKind = Database["public"]["Enums"]["ticket_kind"];
export type TicketStatus = Database["public"]["Enums"]["ticket_status"];
export type StoryStatus = Database["public"]["Enums"]["story_status"];

export type TicketFlowType = "A" | "B" | "C" | "D";

/**
 * Consumer-visible milestones — aligned to product sequences:
 *
 * - A: Scan → Billing → Discount payment → Review
 * - B: Scan → Billing → Story → Discount payment → Review
 * - C: Scan → Billing → Stripe pay → Review → Cashback landing
 * - D: Scan → Billing → Story → Stripe pay → Review → Cashback landing
 */
export type TicketFlowStepId =
  | "scan"
  | "bill"
  | "story"
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

export function ticketFlowTypeFromKind(kind: string): TicketFlowType {
  if (kind === "dp" || kind === "r_dp") return "A";
  if (kind === "s_dp_sf" || kind === "r_s_dp_sf") return "B";
  if (kind === "p_c" || kind === "r_p_c") return "C";
  if (kind === "s_p_sf_c" || kind === "r_s_p_sf_c") return "D";
  if (FORMAL_KINDS.has(kind)) return STORY_KINDS.has(kind) ? "D" : "C";
  return STORY_KINDS.has(kind) ? "B" : "A";
}

export const FLOW_STEPS_BY_TYPE: Record<TicketFlowType, TicketFlowStepId[]> = {
  A: ["scan", "bill", "pay", "review"],
  B: ["scan", "bill", "story", "pay", "review"],
  C: ["scan", "bill", "pay_stripe", "review", "cashback"],
  D: ["scan", "bill", "story", "pay_stripe", "review", "cashback"],
};

export const STEP_LABELS: Record<TicketFlowStepId, string> = {
  scan: "Scan",
  bill: "Billing",
  story: "Story",
  pay: "Pay",
  pay_stripe: "Pay",
  cashback: "Cashback",
  review: "Review",
};

export type StepSequenceLine =
  | string
  | { text: string; struck?: boolean };

export const STEP_SEQUENCE_DETAILS: Record<TicketFlowStepId, StepSequenceLine[]> = {
  scan: [
    "Show your Mesita QR at the table.",
    "Staff scans your code — the bot validates it and starts your visit.",
  ],
  bill: [
    "Staff enters your food & drink subtotal (and tip on cashback visits).",
    "Your bill is calculated with Mesita discount or cashback applied.",
    "You and staff receive payment instructions in the app.",
  ],
  story: [
    "Post an Instagram story tagging Mesita and this venue.",
    {
      text: "Upload a screenshot in the Mesita app.",
      struck: true,
    },
    "We detect the tag automatically and update your ticket.",
    "Staff confirms your story when the bot asks.",
  ],
  pay: [
    "Pay what you owe at the table.",
    "Tap Paid in Mesita when you've paid.",
    "Staff taps paid received to close the visit.",
  ],
  pay_stripe: [
    "Open the secure Stripe checkout link on your phone.",
    "Pay online — your reward applies after payment clears.",
  ],
  cashback: ["Cashback is added to your Mesita balance."],
  review: [
    "Rate food, service, ambiance, and overall.",
    "Add optional comments about your visit.",
  ],
};

export const STEP_SEQUENCE_SUMMARY: Record<
  TicketFlowStepId,
  { done: string; upcoming: string }
> = {
  scan: {
    done: "Your code was scanned — visit started.",
    upcoming: "Show your Mesita QR so staff can scan you in.",
  },
  bill: {
    done: "Your bill with reward is ready.",
    upcoming: "Staff will enter your subtotal next.",
  },
  story: {
    done: "Your story was verified.",
    upcoming: "Post an IG story tagging Mesita and the venue.",
  },
  pay: {
    done: "Payment confirmed with staff.",
    upcoming: "Pay at the table, then tap Paid in Mesita.",
  },
  pay_stripe: {
    done: "Paid online.",
    upcoming: "Complete checkout on your phone.",
  },
  cashback: {
    done: "Cashback added to your Mesita balance.",
    upcoming: "Cashback lands after you pay and review.",
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

function stripePaid(input: TicketProgressInput): boolean {
  return (
    input.status === "paid" ||
    input.status === "awaiting_story" ||
    input.status === "revealed"
  );
}

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
      if (!storyVerified(input.story_status)) return idx("story");
      return idx("pay");
    }
    case "C": {
      if (reviewDone(input) && cashbackLanded(input)) return steps.length;
      if (stripePaid(input) && reviewDone(input) && !cashbackLanded(input)) {
        return idx("cashback");
      }
      if (stripePaid(input) && !reviewDone(input)) return idx("review");
      return idx("pay_stripe");
    }
    case "D": {
      if (reviewDone(input) && cashbackLanded(input)) return steps.length;
      if (stripePaid(input) && reviewDone(input) && !cashbackLanded(input)) {
        return idx("cashback");
      }
      if (stripePaid(input) && !reviewDone(input)) return idx("review");
      if (!storyVerified(input.story_status)) return idx("story");
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
