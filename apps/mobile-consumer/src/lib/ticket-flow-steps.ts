import { storyTagInstruction } from "@/lib/api/pay";

export type TicketStepCopyContext = {
  placeInstagramHandle?: string | null;
};

// Local mirrors of public.Enums — mobile has no database.types.ts copy;
// keep in sync with apps/web-consumer/src/lib/supabase/database.types.ts.
type TicketKind = "reservation" | "coupon";
type TicketStatus =
  | "open"
  | "pending_payment"
  | "paid"
  | "cancelled"
  | "revealed"
  | "awaiting_story"
  | "awaiting_payment_confirm";
type StoryStatus =
  | "not_required"
  | "pending"
  | "submitted"
  | "ai_verified"
  | "ai_rejected"
  | "staff_verified"
  | "staff_rejected";

type TicketFlowType = "A" | "B";

/**
 * Consumer-visible milestones. Mesita is discounts-only; the discount is
 * applied at the bill and the guest pays the discounted total at the table.
 * The consumer never confirms payment — staff tap "Paid received", which
 * closes the ticket. The consumer's Pay step is a passive waiting state.
 *
 * - A: Scan → Bill → Pay → Review
 * - B: Scan → Bill → Story → Pay → Review
 */
export type TicketFlowStepId = "scan" | "bill" | "story" | "pay" | "review";

type TicketFlowStepState = "done" | "active" | "upcoming";

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
  paymentNotificationPending: boolean;
  reviewNotificationPending: boolean;
  reviewCompleted: boolean;
};

const STORY_VERIFIED = new Set<StoryStatus>(["ai_verified", "staff_verified"]);

const STORY_KINDS = new Set(["s_dp_sf", "r_s_dp_sf"]);

export function ticketFlowTypeFromKind(kind: string): TicketFlowType {
  return STORY_KINDS.has(kind) ? "B" : "A";
}

const FLOW_STEPS_BY_TYPE: Record<TicketFlowType, TicketFlowStepId[]> = {
  A: ["scan", "bill", "pay", "review"],
  B: ["scan", "bill", "story", "pay", "review"],
};

const STEP_LABELS: Record<TicketFlowStepId, string> = {
  scan: "Scan",
  bill: "Bill",
  story: "Story",
  pay: "Pay",
  review: "Review",
};

/** Big headline on the ticket card — plain language. */
export const STEP_NOW_TITLE: Record<TicketFlowStepId, string> = {
  scan: "Get scanned in",
  bill: "Here's your bill",
  story: "Post your Instagram story",
  pay: "Pay at the table",
  review: "Leave a quick review",
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
function ticketStepNowInstructions(
  stepId: TicketFlowStepId,
  _progress: TicketProgressInput,
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
        "Staff enter your food & drink total.",
        "Your Mesita discount is already applied below.",
        "Pay the discounted total at the table (cash or card).",
      ];
    case "story":
      return [
        "Post a story on Instagram.",
        storyTagInstruction(ctx?.placeInstagramHandle),
        "Mesita's bot detects your story automatically.",
      ];
    case "pay":
      return [
        "Pay the discounted total at the table (cash or card).",
        "Staff confirm it — then your review unlocks. Nothing to tap here.",
      ];
    case "review":
      return [
        "Tap 1–5 stars on each row (1 = bad, 5 = great).",
        "Start with Overall — it matters most.",
        "Tap Send review when you’re done.",
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
  review: "Review sent",
};

function hasBill(input: TicketProgressInput): boolean {
  return input.total_cents != null && input.total_cents > 0;
}

function storyVerified(story_status: string): boolean {
  return STORY_VERIFIED.has(story_status as StoryStatus);
}

function reviewDone(input: TicketProgressInput): boolean {
  return input.reviewCompleted;
}

/** Staff confirmed payment — the ticket is closed (revealed). */
function staffConfirmedPayment(input: TicketProgressInput): boolean {
  return input.status === "revealed";
}

function inferCurrentIndex(
  flowType: TicketFlowType,
  steps: TicketFlowStepId[],
  input: TicketProgressInput,
): number {
  const idx = (id: TicketFlowStepId) => steps.indexOf(id);

  if (!hasBill(input)) return idx("scan");
  if (flowType === "B" && !storyVerified(input.story_status)) {
    return idx("story");
  }
  if (!staffConfirmedPayment(input)) return idx("pay");
  if (!reviewDone(input)) return idx("review");
  return steps.length;
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
  payment?: { status: string } | null;
  review?: { status: string } | null;
}): TicketProgressInput {
  return {
    kind: input.kind ?? "dp",
    status: input.status ?? "open",
    story_status: input.story_status ?? "not_required",
    story_submitted_at: input.story_submitted_at ?? null,
    total_cents: input.total_cents ?? null,
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
