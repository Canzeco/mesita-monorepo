import type { Database } from "@/lib/supabase/database.types";

export type TicketKind = Database["public"]["Enums"]["ticket_kind"];
export type TicketStatus = Database["public"]["Enums"]["ticket_status"];
export type StoryStatus = Database["public"]["Enums"]["story_status"];

export type TicketFlowType = "A" | "B" | "C" | "D";

export type TicketFlowStepId =
  | "story"
  | "bill"
  | "story_fallback"
  | "pay"
  | "pay_stripe"
  | "story_vuln"
  | "cashback"
  | "review";

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

/** Consumer-facing milestones per ticket type (matches product sequences). */
export const FLOW_STEPS_BY_TYPE: Record<TicketFlowType, TicketFlowStepId[]> = {
  // Type A — Discount, no story: Billing → Discount payment → Review
  A: ["bill", "pay", "review"],
  // Type B — Discount, with story
  B: ["story", "bill", "story_fallback", "pay", "story_vuln", "review"],
  // Type C — Cashback, no story
  C: ["bill", "pay_stripe", "cashback", "review"],
  // Type D — Cashback, with story
  D: [
    "story",
    "bill",
    "story_fallback",
    "pay_stripe",
    "story_vuln",
    "cashback",
    "review",
  ],
};

export const STEP_LABELS: Record<TicketFlowStepId, string> = {
  story: "Story",
  bill: "Bill",
  story_fallback: "Story",
  pay: "Pay",
  pay_stripe: "Pay",
  story_vuln: "Story",
  cashback: "Cashback",
  review: "Review",
};

function hasBill(input: TicketProgressInput): boolean {
  return input.total_cents != null && input.total_cents > 0;
}

function storyVerified(story_status: string): boolean {
  return STORY_VERIFIED.has(story_status as StoryStatus);
}

function payConfirmed(input: TicketProgressInput): boolean {
  return (
    Boolean(input.consumer_payment_confirmed_at) ||
    ["awaiting_story", "revealed", "paid"].includes(input.status)
  );
}

function inferCurrentIndex(
  flowType: TicketFlowType,
  steps: TicketFlowStepId[],
  input: TicketProgressInput,
): number {
  const idx = (id: TicketFlowStepId) => steps.indexOf(id);

  if (input.reviewNotificationPending) return idx("review");

  const allComplete =
    !input.paymentNotificationPending &&
    !input.reviewNotificationPending &&
    (payConfirmed(input) ||
      input.status === "paid" ||
      input.status === "revealed");

  if (allComplete && !input.reviewNotificationPending) {
    return steps.length;
  }

  switch (flowType) {
    case "A": {
      if (
        input.paymentNotificationPending ||
        (input.status === "awaiting_payment_confirm" && !payConfirmed(input))
      ) {
        return idx("pay");
      }
      return idx("bill");
    }
    case "B": {
      const storyOk = storyVerified(input.story_status);
      if (
        payConfirmed(input) &&
        input.status === "awaiting_story" &&
        !storyOk
      ) {
        return idx("story_vuln");
      }
      if (
        input.paymentNotificationPending ||
        (input.status === "awaiting_payment_confirm" && !payConfirmed(input))
      ) {
        return idx("pay");
      }
      if (hasBill(input) && storyOk && !payConfirmed(input)) {
        return idx("story_fallback");
      }
      if (hasBill(input) && !storyOk) {
        return idx("bill");
      }
      return idx("story");
    }
    case "C": {
      if (input.status === "paid" || input.status === "revealed") {
        return steps.length;
      }
      if (input.status === "pending_pay" || input.paymentNotificationPending) {
        return idx("pay_stripe");
      }
      return idx("bill");
    }
    case "D": {
      const storyOk = storyVerified(input.story_status);
      if (input.status === "paid" || input.status === "revealed") {
        return steps.length;
      }
      if (input.status === "awaiting_story") {
        return storyOk ? idx("cashback") : idx("story_vuln");
      }
      if (input.status === "pending_pay" || input.paymentNotificationPending) {
        return idx("pay_stripe");
      }
      if (hasBill(input) && storyOk) {
        return idx("story_fallback");
      }
      if (hasBill(input) && !storyOk) {
        return idx("bill");
      }
      return idx("story");
    }
    default:
      return 0;
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
  };
}
