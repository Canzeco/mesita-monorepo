// THE TICKET v4's step machine (MESITA-1091) — pure, no React, no Supabase.
//
// Extracted so the seven-step machine is TESTABLE: the four-step version
// lived as ~20 lines of nested ternaries inside a 1700-line component where
// no test could reach it, and the one bug that matters here — a fix-request
// bouncing the guest to a step the clamps then refuse — only reproduced at a
// real restaurant. ticket-journey.test.ts sweeps every status × billed ×
// pick × fix combination and asserts the resolved step is always reachable.
//
// The journey (Notion 🦚 Main › Tickets Workflow): the place is picked in
// the wallet, then Bill · Reward · Task · QR · Pay · Validate · Results —
// guest does five, restaurant does one. `fix_requested` is a COLUMN at
// `scanned`, never a status: a send-back returns the guest to the named
// step, same check_code, no new QR.

export type TicketStepId =
  | "bill"
  | "reward"
  | "task"
  | "qr"
  | "pay"
  | "validate"
  | "results";

export const TICKET_STEPS: readonly { id: TicketStepId; label: string }[] = [
  { id: "bill", label: "Bill" },
  { id: "reward", label: "Reward" },
  { id: "task", label: "Task" },
  { id: "qr", label: "QR" },
  { id: "pay", label: "Pay" },
  { id: "validate", label: "Validate" },
  { id: "results", label: "Results" },
];

export function stepIndex(id: TicketStepId): number {
  return TICKET_STEPS.findIndex((s) => s.id === id);
}

export type TicketFix = "bill" | "proof" | "reward";

// D3: name the FIX, never the failure. This is the only moment in Mesita
// where a business tells a guest "no" in front of witnesses — amber, inline,
// no modal, and the words "rejected"/"denied" never appear (pinned by test).
export const FIX_COPY: Record<
  TicketFix,
  { title: string; body: string; step: TicketStepId }
> = {
  bill: {
    title: "Re-enter the bill",
    body: "The amount doesn't match the check. Fix it — their screen updates live, no new QR.",
    step: "bill",
  },
  proof: {
    title: "Re-upload your proof",
    body: "The screenshot didn't come through. Add it again — their screen updates live, no new QR.",
    step: "task",
  },
  reward: {
    title: "Re-check your reward",
    body: "Pick your reward again and resend the bill — their screen updates live, no new QR.",
    step: "reward",
  },
};

export function fixReturnStep(fix: TicketFix): TicketStepId {
  return FIX_COPY[fix].step;
}

export function isTicketFix(v: unknown): v is TicketFix {
  return v === "bill" || v === "proof" || v === "reward";
}

/** Everything the machine needs to know about one ticket, pre-digested. */
export type JourneyInput = {
  /** Raw ticket status (open · scanned · approved · paying · revealed · …). */
  status: string;
  /** The ticket screen's own liveness check (ACTIVE_TICKET_STATUSES). */
  live: boolean;
  /** A bill is on record — C3: the QR is gated on it. */
  billed: boolean;
  /** The place runs a program at all (strategy !== "zero"). */
  priced: boolean;
  /** The guest has made ANY reward pick (an action or explicit base). */
  pickMade: boolean;
  /** The pick is a sharing action (not base). */
  hasAction: boolean;
  /** That action's proof already landed. */
  actionDone: boolean;
  /** Outstanding staff send-back, if any. */
  fix: TicketFix | null;
};

/** Where the ticket naturally IS — before any tap the guest made. */
export function naturalStep(t: JourneyInput): TicketStepId {
  if (!t.live) return "results";
  if (t.status === "paying") return "validate";
  if (t.status === "approved") return "pay";
  if (t.fix) {
    // A fix aimed at a step whose prerequisites are gone (a proof fix on a
    // ticket that no longer carries an action, say) must not deadlock the
    // journey on an unreachable chip — fall through to the ordinary
    // resolution, which walks the guest to the earliest incomplete step.
    const target = fixReturnStep(t.fix);
    if (stepReachable(t, target)) return target;
  }
  if (!t.billed) return "bill";
  if (!t.priced) return "qr";
  if (!t.pickMade) return "reward";
  if (t.hasAction && !t.actionDone) return "task";
  return "qr";
}

/** Which chips accept a tap. Unreachable chips stay visible but inert —
 *  a step that vanishes stops telling you the journey has seven of them. */
export function stepReachable(t: JourneyInput, id: TicketStepId): boolean {
  if (!t.live) return id === "results";
  if (t.status === "paying") return id === "pay" || id === "validate";
  if (t.status === "approved") return id === "pay";
  const editable = t.status === "open" || t.status === "scanned";
  switch (id) {
    case "bill":
      return editable;
    case "reward":
      return editable && t.priced && t.billed;
    case "task":
      return editable && t.priced && t.billed && t.hasAction;
    case "qr":
      // C3: the bill is required ON THE QR — it blocks only the guest,
      // before the restaurant is involved.
      return editable && t.billed;
    case "pay":
    case "validate":
    case "results":
      return false;
  }
}

/**
 * The step to render: the guest's tap when it's still legal, the natural
 * step otherwise. Never returns an unreachable step (the deadlock guard —
 * naturalStep must itself satisfy stepReachable except for the forced
 * pay/validate/results states, which are their own reachability).
 */
export function resolveStep(
  t: JourneyInput,
  choice: TicketStepId | null,
): TicketStepId {
  if (!t.live) return "results";
  if (t.status === "paying") {
    return choice === "pay" ? "pay" : "validate";
  }
  if (t.status === "approved") return "pay";
  const candidate = choice ?? naturalStep(t);
  if (stepReachable(t, candidate)) return candidate;
  return naturalStep(t);
}
