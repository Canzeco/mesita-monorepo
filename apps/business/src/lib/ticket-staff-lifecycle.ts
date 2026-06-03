import type { Database } from "@/lib/supabase/database.types";
import type { BusinessTicket } from "@/lib/api/tickets";

export type TicketKind = Database["public"]["Enums"]["ticket_kind"];
export type TicketStatus = Database["public"]["Enums"]["ticket_status"];
export type StoryStatus = Database["public"]["Enums"]["story_status"];

export type TicketFlowType = "A" | "B" | "C" | "D";

/**
 * Staff-console milestones — aligned to product sequences:
 *
 * - A: Scan → Billing → Discount payment → Done
 * - B: Scan → Billing → Story → Discount payment → Done
 * - C: Scan → Billing → Stripe pay → Cashback landing → Done
 * - D: Scan → Billing → Story → Stripe pay → Cashback landing → Done
 *
 * Review runs on the consumer app after payment (and before cashback on C/D).
 */
export type StaffLifecycleStepId =
  | "scan"
  | "bill"
  | "story"
  | "pay"
  | "stripe"
  | "cashback"
  | "done";

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

const FORMAL_KINDS = new Set<TicketKind>([
  "p_c",
  "s_p_sf_c",
  "r_p_c",
  "r_s_p_sf_c",
]);

const STORY_KINDS = new Set<TicketKind>([
  "s_p_sf_c",
  "r_s_p_sf_c",
  "s_dp_sf",
  "r_s_dp_sf",
]);

export const TICKET_KIND_BY_FLOW_TYPE: Record<TicketFlowType, TicketKind> = {
  A: "dp",
  B: "s_dp_sf",
  C: "p_c",
  D: "s_p_sf_c",
};

export const FLOW_TYPE_LABELS: Record<TicketFlowType, string> = {
  A: "Discount · No story",
  B: "Discount · Story",
  C: "Cashback · Stripe",
  D: "Cashback · Story · Stripe",
};

export function ticketFlowTypeFromKind(kind: string): TicketFlowType {
  if (kind === "dp" || kind === "r_dp") return "A";
  if (kind === "s_dp_sf" || kind === "r_s_dp_sf") return "B";
  if (kind === "p_c" || kind === "r_p_c") return "C";
  if (kind === "s_p_sf_c" || kind === "r_s_p_sf_c") return "D";
  if (FORMAL_KINDS.has(kind as TicketKind)) {
    return STORY_KINDS.has(kind as TicketKind) ? "D" : "C";
  }
  return STORY_KINDS.has(kind as TicketKind) ? "B" : "A";
}

export function ticketHasBill(input: StaffTicketProgressInput): boolean {
  return (input.total_cents ?? 0) > 0;
}

export const STAFF_STEPS_BY_FLOW_TYPE: Record<TicketFlowType, StaffLifecycleStepId[]> =
  {
    A: ["scan", "bill", "pay", "done"],
    B: ["scan", "bill", "story", "pay", "done"],
    C: ["scan", "bill", "stripe", "cashback", "done"],
    D: ["scan", "bill", "story", "stripe", "cashback", "done"],
  };

export const STAFF_STEP_LABELS: Record<StaffLifecycleStepId, string> = {
  scan: "Scan",
  bill: "Billing",
  story: "Story",
  pay: "Payment",
  stripe: "Stripe",
  cashback: "Cashback",
  done: "Done",
};

export function staffDoneStepLabel(kind: string): string {
  return FORMAL_KINDS.has(kind as TicketKind) ? "Complete" : "Revealed";
}

export const STAFF_STEP_HINTS: Record<StaffLifecycleStepId, string> = {
  scan: "Guest code scanned — bot validated and linked the visit.",
  bill: "Enter subtotal (and tip on cashback flows), then send the bill.",
  story: "Guest posts IG story; confirm when the bot asks you to validate.",
  pay: "Guest taps Paid in Mesita — tap Mark paid when you receive payment.",
  stripe: "Guest pays via the Stripe checkout link on their phone.",
  cashback: "Cashback credits to their Mesita balance after pay and review.",
  done: "Visit closed.",
};

function storyComplete(input: StaffTicketProgressInput): boolean {
  if (!STORY_KINDS.has(input.kind as TicketKind)) return true;
  if (input.story_status === "not_required") return true;
  return STORY_VERIFIED.has(input.story_status as StoryStatus);
}

function discountPaid(input: StaffTicketProgressInput): boolean {
  return input.status === "revealed";
}

function stripePaid(input: StaffTicketProgressInput): boolean {
  return (
    input.status === "paid" ||
    input.status === "awaiting_story" ||
    input.status === "revealed"
  );
}

function cashbackLanded(input: StaffTicketProgressInput): boolean {
  if (!FORMAL_KINDS.has(input.kind as TicketKind)) return true;
  return input.status === "paid" || input.status === "revealed";
}

function visitComplete(input: StaffTicketProgressInput): boolean {
  if (input.status === "cancelled") return false;
  if (FORMAL_KINDS.has(input.kind as TicketKind)) {
    return input.status === "paid";
  }
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
      return discountPaid(input);
    case "stripe":
      return stripePaid(input);
    case "cashback":
      return cashbackLanded(input);
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
      label: id === "done" ? staffDoneStepLabel(input.kind) : STAFF_STEP_LABELS[id],
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
    case "awaiting_payment_confirm":
      return "Awaiting payment";
    case "pending_pay":
      return "Pending pay";
    case "awaiting_story":
      return "Awaiting story";
    case "paid":
      return "Paid";
    case "revealed":
      return "Revealed";
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
  if (status === "pending_pay" || status === "awaiting_payment_confirm") {
    return "bg-amber-500/10 text-amber-800";
  }
  if (status === "paid" || status === "revealed") {
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

/** Discount flows: guest issued paid, staff confirms received. */
export function ticketNeedsStaffPaymentConfirm(ticket: BusinessTicket): boolean {
  if (FORMAL_KINDS.has(ticket.kind as TicketKind)) {
    return ticket.status === "pending_pay";
  }
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
    ticket.status === "pending_pay" ||
    ticket.status === "awaiting_payment_confirm"
  );
}
