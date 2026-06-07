import type { Database } from "@/lib/supabase/database.types";
import type { BusinessTicket } from "@/lib/api/tickets";

export type TicketKind = Database["public"]["Enums"]["ticket_kind"];
export type TicketStatus = Database["public"]["Enums"]["ticket_status"];
export type StoryStatus = Database["public"]["Enums"]["story_status"];

export type TicketFlowType = "A" | "B";

/**
 * Staff-console milestones. Mesita is discounts-only; the discount is applied
 * at the bill and the guest pays the discounted total at the table. Staff
 * confirm payment ("Paid received") to close the ticket — the consumer never
 * confirms.
 *
 * - A: Scan → Billing → Payment → Done
 * - B: Scan → Billing → Story → Payment → Done
 *
 * Review runs on the consumer app after the ticket closes.
 */
export type StaffLifecycleStepId = "scan" | "bill" | "story" | "pay" | "done";

export type StaffLifecycleStepState = "done" | "active" | "upcoming";

export type StaffLifecycleStepView = {
  id: StaffLifecycleStepId;
  label: string;
  state: StaffLifecycleStepState;
  hint?: string;
};

export type StaffTicketProgressInput = Pick<
  BusinessTicket,
  "kind" | "status" | "story_status" | "check_subtotal_cents" | "total_cents"
>;

const STORY_VERIFIED = new Set<StoryStatus>(["ai_verified", "waiter_verified"]);

const STORY_KINDS = new Set<TicketKind>(["s_dp_sf", "r_s_dp_sf"]);

export const TICKET_KIND_BY_FLOW_TYPE: Record<TicketFlowType, TicketKind> = {
  A: "dp",
  B: "s_dp_sf",
};

export const FLOW_TYPE_LABELS: Record<TicketFlowType, string> = {
  A: "Discount · No story",
  B: "Discount · With story",
};

// Short, distinguishing label for the scan picker chips. Both flows are a
// discount; the only difference is whether the guest posts an IG story, so
// the chip leads with that.
export const FLOW_TYPE_SHORT_LABELS: Record<TicketFlowType, string> = {
  A: "No story",
  B: "With story",
};

export function ticketFlowTypeFromKind(kind: string): TicketFlowType {
  return STORY_KINDS.has(kind as TicketKind) ? "B" : "A";
}

export function ticketHasBill(input: StaffTicketProgressInput): boolean {
  return (input.total_cents ?? 0) > 0;
}

export const STAFF_STEPS_BY_FLOW_TYPE: Record<
  TicketFlowType,
  StaffLifecycleStepId[]
> = {
  A: ["scan", "bill", "pay", "done"],
  B: ["scan", "bill", "story", "pay", "done"],
};

export const STAFF_STEP_LABELS: Record<StaffLifecycleStepId, string> = {
  scan: "Scan",
  bill: "Billing",
  story: "Story",
  pay: "Payment",
  done: "Done",
};

export function staffDoneStepLabel(_kind: string): string {
  return "Closed";
}

export const STAFF_STEP_HINTS: Record<StaffLifecycleStepId, string> = {
  scan: "Guest code scanned — bot validated and linked the visit.",
  bill: "Enter the subtotal and send the bill. The guest pays the discounted total at the table.",
  story: "Guest posts IG story; confirm when the bot asks you to validate.",
  pay: "Tap Paid received once the guest pays — that closes the ticket.",
  done: "Visit closed.",
};

function storyComplete(input: StaffTicketProgressInput): boolean {
  if (!STORY_KINDS.has(input.kind as TicketKind)) return true;
  if (input.story_status === "not_required") return true;
  return STORY_VERIFIED.has(input.story_status as StoryStatus);
}

function paymentConfirmed(input: StaffTicketProgressInput): boolean {
  return input.status === "revealed";
}

function visitComplete(input: StaffTicketProgressInput): boolean {
  if (input.status === "cancelled") return false;
  return input.status === "revealed";
}

function stepComplete(
  stepId: StaffLifecycleStepId,
  input: StaffTicketProgressInput,
): boolean {
  switch (stepId) {
    case "scan":
      return true;
    case "bill":
      return ticketHasBill(input);
    case "story":
      return storyComplete(input);
    case "pay":
      return paymentConfirmed(input);
    case "done":
      return visitComplete(input);
    default:
      return false;
  }
}

function inferCurrentIndex(
  stepIds: StaffLifecycleStepId[],
  input: StaffTicketProgressInput,
): number {
  if (input.status === "cancelled") {
    const billIdx = stepIds.indexOf("bill");
    return billIdx >= 0 ? billIdx : 0;
  }

  for (let i = 0; i < stepIds.length; i++) {
    if (!stepComplete(stepIds[i], input)) return i;
  }
  return stepIds.length;
}

export function resolveStaffLifecycleSteps(
  input: StaffTicketProgressInput,
): StaffLifecycleStepView[] {
  const flowType = ticketFlowTypeFromKind(input.kind);
  const stepIds = STAFF_STEPS_BY_FLOW_TYPE[flowType];
  const currentIndex = inferCurrentIndex(stepIds, input);

  return stepIds.map((id, index) => {
    const state: StaffLifecycleStepState =
      index < currentIndex
        ? "done"
        : index === currentIndex
          ? "active"
          : "upcoming";

    return {
      id,
      label:
        id === "done" ? staffDoneStepLabel(input.kind) : STAFF_STEP_LABELS[id],
      state,
      hint: state === "active" ? STAFF_STEP_HINTS[id] : undefined,
    };
  });
}

export function staffLifecycleFromTicket(
  ticket: BusinessTicket,
): StaffLifecycleStepView[] {
  return resolveStaffLifecycleSteps({
    kind: ticket.kind,
    status: ticket.status,
    story_status: ticket.story_status,
    check_subtotal_cents: ticket.check_subtotal_cents,
    total_cents: ticket.total_cents,
  });
}

export function staffStatusLabel(status: TicketStatus): string {
  switch (status) {
    case "awaiting_story":
      return "Awaiting story";
    case "awaiting_payment_confirm":
      return "Awaiting payment";
    case "revealed":
      return "Closed";
    case "cancelled":
      return "Cancelled";
    case "open":
      return "Awaiting bill";
    default: {
      const raw = status as string;
      return raw.replaceAll("_", " ");
    }
  }
}

export function staffStatusTone(status: TicketStatus): string {
  if (status === "open") {
    return "bg-sky-500/10 text-sky-800";
  }
  if (status === "awaiting_payment_confirm") {
    return "bg-amber-500/10 text-amber-800";
  }
  if (status === "revealed") {
    return "bg-emerald-500/10 text-emerald-800";
  }
  if (status === "awaiting_story") {
    return "bg-violet-500/10 text-violet-800";
  }
  if (status === "cancelled") {
    return "bg-muted text-muted-foreground";
  }
  return "bg-secondary/10 text-secondary";
}

/** Staff payment confirm: guest pays at the table, staff tap Paid received. */
export function ticketNeedsStaffPaymentConfirm(
  ticket: BusinessTicket,
): boolean {
  return ticket.status === "awaiting_payment_confirm";
}

export function ticketNeedsStoryConfirm(ticket: BusinessTicket): boolean {
  if (!STORY_KINDS.has(ticket.kind as TicketKind)) return false;
  if (ticket.status === "cancelled" || !ticketHasBill(ticket)) return false;
  return (
    ticket.story_status === "pending" ||
    ticket.story_status === "submitted" ||
    ticket.story_status === "ai_rejected"
  );
}

export function ticketNeedsBill(ticket: BusinessTicket): boolean {
  return ticket.status === "open" && !ticketHasBill(ticket);
}

export function ticketCanCancel(ticket: BusinessTicket): boolean {
  return (
    ticket.status === "open" ||
    ticket.status === "awaiting_story" ||
    ticket.status === "awaiting_payment_confirm"
  );
}
