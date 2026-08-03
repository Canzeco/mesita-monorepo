import { storyTagInstruction } from '@/lib/api/pay';

type TicketStepCopyContext = {
  placeInstagramHandle?: string | null;
};

// Local mirrors of public.Enums — mobile has no database.types.ts copy;
// keep in sync with apps/web-consumer/src/lib/supabase/database.types.ts.
type TicketKind = 'reservation' | 'coupon';
type TicketStatus =
  | 'open'
  | 'pending_payment'
  | 'paid'
  | 'cancelled'
  | 'revealed'
  | 'awaiting_story'
  | 'awaiting_payment_confirm';
type StoryStatus =
  | 'not_required'
  | 'pending'
  | 'submitted'
  | 'ai_verified'
  | 'ai_rejected'
  | 'staff_verified'
  | 'staff_rejected';

type TicketFlowType = 'A' | 'B';

/**
 * Consumer-visible milestones. Mesita is discounts-only; the discount is
 * applied at the bill and the guest pays the discounted total at the table.
 * The consumer never confirms payment — staff tap 'Paid received', which
 * closes the ticket. The consumer's Pay step is a passive waiting state.
 *
 * Lifecycle v3 (MESITA-849): the guest's TASKS come FIRST, before staff are
 * involved at all. Nobody on the floor adjudicates them — the guest does the
 * thing and says so, and the rail reflects that order.
 *
 * - A: Review → Scan → Bill → Pay
 * - B: Story → Review → Scan → Bill → Pay
 */
export type TicketFlowStepId = 'scan' | 'bill' | 'story' | 'pay' | 'review';

type TicketFlowStepState = 'done' | 'active' | 'upcoming';

export type TicketFlowStepView = {
  id: TicketFlowStepId;
  label: string;
  state: TicketFlowStepState;
};

type TicketProgressInput = {
  kind: TicketKind | string;
  status: TicketStatus | string;
  story_status: StoryStatus | string;
  story_submitted_at?: string | null;
  first_scanned_at?: string | null;
  total_cents?: number | null;
  paymentNotificationPending: boolean;
  reviewNotificationPending: boolean;
  reviewCompleted: boolean;
};

// `self_verified` is the v3 state (MESITA-849) — the guest's own declaration.
// The other two are read-only history from the retired bot/staff verdicts.
const STORY_VERIFIED = new Set<StoryStatus | string>([
  'self_verified',
  'ai_verified',
  'staff_verified',
]);

/**
 * Whether this ticket carries the Story rung. Read off `story_status`, which
 * is where the requirement actually lives — the old check keyed on legacy
 * `kind` strings (`s_dp_sf`, `r_s_dp_sf`) that the ticket_kind enum
 * (reservation | coupon) has not produced in a long time, so every ticket
 * silently resolved to the no-story flow and the Story step never rendered.
 */
export function ticketFlowTypeFromStoryStatus(
  storyStatus: string | null | undefined,
): TicketFlowType {
  return storyStatus != null && storyStatus !== 'not_required' ? 'B' : 'A';
}

const FLOW_STEPS_BY_TYPE: Record<TicketFlowType, TicketFlowStepId[]> = {
  A: ['review', 'scan', 'bill', 'pay'],
  B: ['story', 'review', 'scan', 'bill', 'pay'],
};

const STEP_LABELS: Record<TicketFlowStepId, string> = {
  scan: 'Scan',
  bill: 'Bill',
  story: 'Story',
  pay: 'Pay',
  review: 'Review',
};

/** Big headline on the ticket card — plain language. */
export const STEP_NOW_TITLE: Record<TicketFlowStepId, string> = {
  scan: 'Show your QR',
  bill: "Here's your bill",
  story: 'Post your Instagram story',
  pay: 'Pay at the table',
  review: 'Leave a quick review',
};

/** At most two short lines for the ticket help panel. */
export function ticketStepDummyInstructions(
  stepId: TicketFlowStepId,
  progress: TicketProgressInput,
  ctx?: TicketStepCopyContext,
): string[] {
  const lines = ticketStepNowInstructions(stepId, ctx);
  if (lines.length === 0) return [];
  if (stepId === 'story') return lines;
  if (lines.length === 1) return lines;
  return lines.slice(0, 2);
}

/** Short numbered steps shown under the headline (active step only). */
function ticketStepNowInstructions(
  stepId: TicketFlowStepId,
  ctx?: TicketStepCopyContext,
): string[] {
  switch (stepId) {
    case 'scan':
      // Tickets v2 (MESITA-806): the guest creates the ticket; the QR IS the
      // ticket (mesita.ai/check/<code>) and staff scan it to verify.
      return [
        'Finish your tasks above first — they set your discount.',
        'Then show this QR; staff scan it with any phone camera.',
        "It opens Mesita's check page — your visit starts.",
      ];
    case 'bill':
      return [
        'Staff enter your food & drink total.',
        'Your Mesita discount is already applied below.',
        'Pay the discounted total at the table (cash or card).',
      ];
    case 'story':
      return [
        'Post a story on Instagram — before you get scanned.',
        storyTagInstruction(ctx?.placeInstagramHandle),
        'Then tap the button to add it to this ticket.',
      ];
    case 'pay':
      return [
        'Pay the discounted total at the table (cash or card).',
        'Staff confirm it — then your review unlocks. Nothing to tap here.',
      ];
    case 'review':
      return [
        'Tap 1–5 stars on each row (1 = bad, 5 = great).',
        'Start with Overall — it matters most.',
        'Tap Send review when you’re done.',
      ];
    default:
      return [];
  }
}

/** One line under each step in the checklist. */
export const STEP_DONE_LINE: Record<TicketFlowStepId, string> = {
  scan: 'Scanned',
  bill: 'Bill ready',
  story: 'Story OK',
  pay: 'Paid',
  review: 'Review sent',
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
  return input.status === 'revealed';
}

/** Staff have opened the check page for this ticket. */
function scanned(input: TicketProgressInput): boolean {
  // first_scanned_at is authoritative; a bill can only exist post-scan, so it
  // stands in for older rows that predate the column being threaded through.
  return input.first_scanned_at != null || hasBill(input);
}

// Walked in rail order (v3: tasks, then the floor). The first unfinished step
// is the active one; falling off the end means the ticket is complete.
function inferCurrentIndex(
  flowType: TicketFlowType,
  steps: TicketFlowStepId[],
  input: TicketProgressInput,
): number {
  const idx = (id: TicketFlowStepId) => steps.indexOf(id);

  if (flowType === 'B' && !storyVerified(input.story_status)) {
    return idx('story');
  }
  if (!reviewDone(input)) return idx('review');
  if (!scanned(input)) return idx('scan');
  if (!hasBill(input)) return idx('bill');
  if (!staffConfirmedPayment(input)) return idx('pay');
  return steps.length;
}

function resolveCurrentStep(input: TicketProgressInput): {
  stepIds: TicketFlowStepId[];
  currentIndex: number;
} {
  const flowType = ticketFlowTypeFromStoryStatus(input.story_status);
  const stepIds = FLOW_STEPS_BY_TYPE[flowType];
  const currentIndex = inferCurrentIndex(flowType, stepIds, input);
  return { stepIds, currentIndex };
}

export function resolveTicketFlowSteps(
  input: TicketProgressInput,
): TicketFlowStepView[] {
  const { stepIds, currentIndex } = resolveCurrentStep(input);

  return stepIds.map((id, index) => ({
    id,
    label: STEP_LABELS[id],
    state:
      index < currentIndex
        ? 'done'
        : index === currentIndex
          ? 'active'
          : 'upcoming',
  }));
}

export function ticketProgressFromBundle(input: {
  kind?: string | null;
  status?: string | null;
  story_status?: string | null;
  story_submitted_at?: string | null;
  first_scanned_at?: string | null;
  total_cents?: number | null;
  payment?: { status: string } | null;
  review?: { status: string } | null;
}): TicketProgressInput {
  return {
    kind: input.kind ?? 'dp',
    status: input.status ?? 'open',
    story_status: input.story_status ?? 'not_required',
    story_submitted_at: input.story_submitted_at ?? null,
    first_scanned_at: input.first_scanned_at ?? null,
    total_cents: input.total_cents ?? null,
    paymentNotificationPending: input.payment?.status === 'pending',
    reviewNotificationPending: input.review?.status === 'pending',
    reviewCompleted: input.review?.status === 'completed',
  };
}

export function isTicketFlowComplete(input: TicketProgressInput): boolean {
  const { stepIds, currentIndex } = resolveCurrentStep(input);
  return currentIndex >= stepIds.length;
}
