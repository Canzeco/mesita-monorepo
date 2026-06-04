import { storyTagInstruction } from "@/lib/api/pay";
import type { Database } from "@/lib/supabase/database.types";

export type TicketStepCopyContext = {
  venueInstagramHandle?: string | null;
};

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
  staff_payment_confirmed_at?: string | null;
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
  bill: "Bill",
  story: "Story",
  pay: "Pay",
  pay_stripe: "Pay online",
  cashback: "Cashback",
  review: "Review",
};

/** One-line hint under each step in the ticket menu. */
export const STEP_MENU_HINT: Record<TicketFlowStepId, string> = {
  scan: "Show QR to waiter",
  bill: "Staff adds your total",
  story: "Instagram story + tags",
  pay: "Pay table, then tap below",
  pay_stripe: "Pay link on your phone",
  review: "Tap stars, then send",
  cashback: "Check Pay → Balance",
};

/** Big headline on the ticket card — plain language. */
export const STEP_NOW_TITLE: Record<TicketFlowStepId, string> = {
  scan: "Get scanned in",
  bill: "Wait for your bill",
  story: "Post your Instagram story",
  pay: "Pay at the table",
  pay_stripe: "Pay on your phone",
  review: "Leave a quick review",
  cashback: "Cashback is on the way",
};

/** At most two short lines for the ticket help panel. */
export function ticketStepDummyInstructions(
  stepId: TicketFlowStepId,
  progress: TicketProgressInput,
  ctx?: TicketStepCopyContext,
): string[] {
  const lines = ticketStepNowInstructions(stepId, progress, ctx);
  if (lines.length === 0) return [];
  if (stepId === "story") return lines;
  if (lines.length === 1) return lines;
  return lines.slice(0, 2);
}

/** Short numbered steps shown under the headline (active step only). */
export function ticketStepNowInstructions(
  stepId: TicketFlowStepId,
  progress: TicketProgressInput,
  ctx?: TicketStepCopyContext,
): string[] {
  switch (stepId) {
    case "scan":
      return [
        "Open Mesita → Pay → QR.",
        "Show that code to your waiter.",
        "They scan it — your visit starts.",
      ];
    case "bill":
      return [
        "Staff enters your food & drink total.",
        "Your Mesita discount or cashback is applied automatically.",
        "Check the bill below matches what they told you.",
      ];
    case "story":
      return [
        "Post a story on Instagram.",
        storyTagInstruction(ctx?.venueInstagramHandle),
        "Mesita's bot detects your story automatically.",
      ];
    case "pay": {
      const phase = discountPaymentPhase(progress);
      if (phase === "pending") {
        return [
          "Pay the amount due at the table (cash or card).",
          "Come back here and tap “I paid — Paid issued”.",
          "Staff taps “Paid received” — then you can review.",
        ];
      }
      if (phase === "issued") {
        return [
          "You already tapped “I paid”.",
          "Ask staff to confirm “Paid received” on their side.",
        ];
      }
      return [];
    }
    case "pay_stripe":
      return [
        "Open the payment link staff sends you (Stripe).",
        "Pay on your phone — stay on this screen until it updates.",
      ];
    case "review":
      return [
        "Tap 1–5 stars on each row (1 = bad, 5 = great).",
        "Start with Overall — it matters most.",
        "Tap Send review when you’re done.",
      ];
    case "cashback":
      return [
        "After your review, cashback is added to Mesita.",
        "Check Pay → Balance in a minute or two.",
      ];
    default:
      return [];
  }
}

/** One line under each step in the checklist. */
export const STEP_DONE_LINE: Record<TicketFlowStepId, string> = {
  scan: "Scanned",
  bill: "Bill ready",
  story: "Story OK",
  pay: "Paid",
  pay_stripe: "Paid online",
  review: "Review sent",
  cashback: "In your balance",
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
    "Tap Paid issued in Mesita when you've paid.",
    "Staff taps Paid received to close the visit.",
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
    done: "You and staff both confirmed payment.",
    upcoming: "Pay, then tap Paid issued.",
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

export type DiscountPaymentPhase = "pending" | "issued" | "complete";

/** Discount (type A/B): both Paid issued and Paid received, or ticket revealed. */
export function discountPaymentPhase(
  input: TicketProgressInput,
): DiscountPaymentPhase {
  if (input.status === "revealed") return "complete";
  if (
    input.consumer_payment_confirmed_at &&
    input.staff_payment_confirmed_at
  ) {
    return "complete";
  }
  if (input.consumer_payment_confirmed_at) return "issued";
  return "pending";
}

function discountPaymentComplete(input: TicketProgressInput): boolean {
  return discountPaymentPhase(input) === "complete";
}

export function payStepActiveSummary(input: TicketProgressInput): string {
  const lines = ticketStepNowInstructions("pay", input);
  return lines[0] ?? STEP_SEQUENCE_SUMMARY.pay.upcoming;
}

/** One-line fallback under the step label in the checklist. */
export function ticketStepActiveInstruction(
  stepId: TicketFlowStepId,
  progress: TicketProgressInput,
  ctx?: TicketStepCopyContext,
): string {
  const lines = ticketStepNowInstructions(stepId, progress, ctx);
  if (lines.length === 0) return "";
  if (lines.length === 1) return lines[0];
  return lines.join(" ");
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
      if (discountPaymentComplete(input) && reviewDone(input)) return steps.length;
      if (discountPaymentComplete(input)) return idx("review");
      return idx("pay");
    }
    case "B": {
      if (discountPaymentComplete(input) && reviewDone(input)) return steps.length;
      if (discountPaymentComplete(input)) return idx("review");
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
  staff_payment_confirmed_at?: string | null;
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
    staff_payment_confirmed_at: input.staff_payment_confirmed_at ?? null,
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
