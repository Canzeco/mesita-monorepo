// THE TICKET v4 step machine (MESITA-1091). The one bug class that matters —
// a send-back returning the guest to a step the clamps refuse, leaving the
// fix banner with no way to act on it — only reproduced at a real restaurant
// under the old in-component machine. Here the whole input space is swept.

import { describe, expect, it } from "vitest";
import {
  FIX_COPY,
  TICKET_STEPS,
  type JourneyInput,
  type TicketFix,
  type TicketStepId,
  fixReturnStep,
  naturalStep,
  resolveStep,
  stepReachable,
} from "@/lib/ticket-journey";

const STATUSES = [
  "open",
  "scanned",
  "approved",
  "paying",
  "revealed",
  "cancelled",
] as const;
const LIVE = new Set(["open", "scanned", "approved", "paying"]);
const FIXES: (TicketFix | null)[] = [null, "bill", "proof", "reward"];
const BOOLS = [false, true] as const;

function* inputs(): Generator<JourneyInput> {
  for (const status of STATUSES) {
    for (const billed of BOOLS) {
      for (const priced of BOOLS) {
        for (const pickMade of BOOLS) {
          for (const hasAction of BOOLS) {
            for (const actionDone of BOOLS) {
              for (const fix of FIXES) {
                // fix only exists at scanned (a column, never a status), and
                // an action state implies a pick was made.
                if (fix && status !== "scanned") continue;
                if (hasAction && !pickMade) continue;
                yield {
                  status,
                  live: LIVE.has(status),
                  billed,
                  priced,
                  pickMade,
                  hasAction,
                  actionDone,
                  fix,
                };
              }
            }
          }
        }
      }
    }
  }
}

describe("the seven steps", () => {
  it("are exactly Bill · Reward · Task · QR · Pay · Validate · Results", () => {
    expect(TICKET_STEPS.map((s) => s.id)).toEqual([
      "bill",
      "reward",
      "task",
      "qr",
      "pay",
      "validate",
      "results",
    ]);
    expect(TICKET_STEPS.map((s) => s.label)).toEqual([
      "Bill",
      "Reward",
      "Task",
      "QR",
      "Pay",
      "Validate",
      "Results",
    ]);
  });
});

describe("the deadlock guard", () => {
  it("resolveStep never lands on a step the guest cannot act on", () => {
    const choices: (TicketStepId | null)[] = [
      null,
      ...TICKET_STEPS.map((s) => s.id),
    ];
    for (const t of inputs()) {
      for (const choice of choices) {
        const step = resolveStep(t, choice);
        // The resolved step is either reachable by the tap rules, or one of
        // the machine-forced states (pay/validate/results) matching the
        // ticket's own status.
        const forced =
          (!t.live && step === "results") ||
          (t.status === "approved" && step === "pay") ||
          (t.status === "paying" && (step === "validate" || step === "pay"));
        expect(
          forced || stepReachable(t, step),
          `unreachable ${step} for ${JSON.stringify(t)} choice=${choice}`,
        ).toBe(true);
      }
    }
  });

  it("naturalStep honours the journey's own prerequisites", () => {
    for (const t of inputs()) {
      const step = naturalStep(t);
      if (!t.live) {
        expect(step).toBe("results");
        continue;
      }
      if (step === "qr") expect(t.billed).toBe(true);
      if (step === "task") expect(t.hasAction).toBe(true);
      if (step === "reward") expect(t.billed && t.priced).toBe(true);
    }
  });
});

describe("the fix loop (D3)", () => {
  it("returns the guest to the named step", () => {
    expect(fixReturnStep("bill")).toBe("bill");
    expect(fixReturnStep("proof")).toBe("task");
    expect(fixReturnStep("reward")).toBe("reward");
  });

  it("a fix at scanned resolves to its own step and that step is reachable", () => {
    for (const fix of ["bill", "proof", "reward"] as TicketFix[]) {
      const t: JourneyInput = {
        status: "scanned",
        live: true,
        billed: true,
        priced: true,
        pickMade: true,
        hasAction: true,
        actionDone: true,
        fix,
      };
      const step = resolveStep(t, null);
      expect(step).toBe(fixReturnStep(fix));
      expect(stepReachable(t, step)).toBe(true);
    }
  });

  it("names the fix, never the failure", () => {
    const banned = /rejected|denied|refused|invalid|failed/i;
    for (const copy of Object.values(FIX_COPY)) {
      expect(copy.title).not.toMatch(banned);
      expect(copy.body).not.toMatch(banned);
    }
  });
});

describe("the machine's spine", () => {
  const base: JourneyInput = {
    status: "open",
    live: true,
    billed: false,
    priced: true,
    pickMade: false,
    hasAction: false,
    actionDone: false,
    fix: null,
  };

  it("an unbilled ticket starts at the bill — C3, the QR is gated on it", () => {
    expect(naturalStep(base)).toBe("bill");
    expect(stepReachable(base, "qr")).toBe(false);
  });

  it("billed → reward → task → qr, in order", () => {
    const billed = { ...base, billed: true };
    expect(naturalStep(billed)).toBe("reward");
    const picked = { ...billed, pickMade: true, hasAction: true };
    expect(naturalStep(picked)).toBe("task");
    const done = { ...picked, actionDone: true };
    expect(naturalStep(done)).toBe("qr");
    const baseOnly = { ...billed, pickMade: true };
    expect(naturalStep(baseOnly)).toBe("qr");
  });

  it("approval locks the journey onto Pay; paying onto Validate", () => {
    const approved = { ...base, status: "approved", billed: true };
    expect(resolveStep(approved, "bill")).toBe("pay");
    expect(stepReachable(approved, "bill")).toBe(false);
    const paying = { ...base, status: "paying", billed: true };
    expect(resolveStep(paying, null)).toBe("validate");
    expect(resolveStep(paying, "pay")).toBe("pay");
  });

  it("terminal statuses always resolve to results", () => {
    for (const status of ["revealed", "cancelled"]) {
      const t = { ...base, status, live: false };
      expect(resolveStep(t, "bill")).toBe("results");
    }
  });

  it("a zero-strategy place skips reward and task", () => {
    const t = { ...base, billed: true, priced: false };
    expect(naturalStep(t)).toBe("qr");
    expect(stepReachable(t, "reward")).toBe(false);
    expect(stepReachable(t, "task")).toBe(false);
  });
});
