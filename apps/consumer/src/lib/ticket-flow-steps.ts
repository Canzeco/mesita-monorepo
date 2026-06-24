import { storyTagInstruction } from "@/lib/api/pay";
import type { Database } from "@/lib/supabase/database.types";

export type TicketStepCopyContext = {
  venueInstagramHandle?: string | null;
};

export type TicketKind = Database["public"]["Enums"]["ticket_kind"];
export type TicketStatus = Database["public"]["Enums"]["ticket_status"];
export type StoryStatus = Database["public"]["Enums"]["story_status"];

export type TicketFlowType = "A" | "B";

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
  paymentNotificationPending: boolean;
  reviewNotificationPending: boolean;
  reviewCompleted: boolean;
};

const STORY_VERIFIED = new Set<StoryStatus>(["ai_verified", "waiter_verified"]);

const STORY_KINDS = new Set(["s_dp_sf", "r_s_dp_sf"]);

export function ticketFlowTypeFromKind(kind: string): TicketFlowType {
  return STORY_KINDS.has(kind) ? "B" : "A";
}

export const FLOW_STEPS_BY_TYPE: Record<TicketFlowType, TicketFlowStepId[]> = {
  A: ["scan", "bill", "pay", "review"],
  B: ["scan", "bill", "story", "pay", "review"],
};

export const STEP_LABELS: Record<TicketFlowStepId, string> = {
  scan: "Scan",
  bill: "Bill",
  story: "Story",
  pay: "Pay",
  review: "Review",
};

/** One-line hint under each step in the ticket menu. */
export const STEP_MENU_HINT: Record<TicketFlowStepId, string> = {
  scan: "Show QR to waiter",
  bill: "Staff adds your total",
  story: "Instagram story + tags",
  pay: "Pay table; staff confirms",
  review: "Tap stars, then send",
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
export function ticketStepNowInstructions(
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
        storyTagInstruction(ctx?.venueInstagramHandle),
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

export type StepSequenceLine = string | { text: string; struck?: boolean };

export const STEP_SEQUENCE_DETAILS: Record<
  TicketFlowStepId,
  StepSequenceLine[]
> = {
  scan: [
    "Show your Mesita QR at the table.",
    "Staff scans your code — the bot validates it and starts your visit.",
  ],
  bill: [
    "Staff enter your food & drink subtotal.",
    "Your bill is calculated with your Mesita discount applied.",
    "Pay the discounted total at the table — Mesita never touches the money.",
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
    "Pay the discounted total at the table — Mesita never touches the money.",
    "Staff tap Paid received to close your visit. You don't confirm anything.",
  ],
  review: [
    "Rate food, service, ambiance, value, and overall.",
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
    done: "Staff confirmed your payment.",
    upcoming: "Pay at the table; staff confirm to close it.",
  },
  review: {
    done: "Thanks — your review was submitted.",
    upcoming: "Rate your visit when you're ready.",
  },
};

export function ticketFlowStepAnchorId(stepId: TicketFlowStepId): string {
  return `ticket-flow-step-${stepId}`;
}

export function ticketFlowStepStatusLabel(step: TicketFlowStepView): string {
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
