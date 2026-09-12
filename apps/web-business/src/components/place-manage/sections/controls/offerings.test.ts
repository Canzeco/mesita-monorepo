import { describe, expect, it } from "vitest";
import {
  guestSummary,
  offeringRows,
  paintRows,
  topPrerequisite,
  type LadderInput,
} from "./offerings";

const BASE: LadderInput = {
  member: true,
  visitRewardsLevel: 0,
  rails: {
    mesita_pay: false,
    credits: false,
    pickup: false,
    delivery: false,
    reservations: null,
  },
  connect: { kind: "none" },
};

function stripeRow(input: LadderInput) {
  const row = offeringRows(input).find((r) => r.key === "stripe");
  if (!row) throw new Error("no stripe row");
  return row;
}

describe("the stripe rung's copy — org state, not place state (MESITA-1684)", () => {
  it("says the ORGANIZATION owns the account, never the place", () => {
    const row = stripeRow(BASE);
    expect(row.detail).toContain("Your organization owns the account");
    expect(row.detail).not.toContain("The place owns");
  });

  it("still names a place-relevant consequence when Stripe needs more detail", () => {
    const row = stripeRow({
      ...BASE,
      connect: { kind: "incomplete", requirementsDue: ["individual.id_number"] },
    });
    expect(row.detail).toContain("this place can be paid");
  });
});

// ── MESITA-1735 ───────────────────────────────────────────────────────────

function rowFor(input: LadderInput, key: string) {
  const row = offeringRows(input).find((r) => r.key === key);
  if (!row) throw new Error(`no ${key} row`);
  return row;
}

describe("T5 — the console must not disagree with the consumer app", () => {
  // web-consumer's `isReserveActionEnabled` is exactly
  // `row?.reservations_enabled === true`
  // (apps/web-consumer/src/lib/place-profile-actions.ts). Two packages, two
  // install roots, so the predicate is restated here as a literal rather than
  // imported — and THAT is the thing under test. The console used to answer
  // this question with a hard-coded `{ kind: "off" }` while the consumer app
  // rendered a live Reserve CTA off the same column.
  const consumerSays = (reservationsEnabled: boolean | null) =>
    reservationsEnabled === true;

  for (const value of [true, false, null] as const) {
    it(`agrees for reservations_enabled = ${String(value)}`, () => {
      const row = rowFor({ ...BASE, rails: { ...BASE.rails, reservations: value } }, "reservations");
      if (row.state.kind !== "not_mine") {
        throw new Error(`expected not_mine, got ${row.state.kind}`);
      }
      // null stays null — the row says Unknown, and Unknown is not a claim
      // that the place takes no bookings.
      expect(row.state.on).toBe(value);
      if (value !== null) expect(row.state.on === true).toBe(consumerSays(value));
    });
  }

  it("never renders a switch for reservations — nothing writes it from here", () => {
    const row = rowFor({ ...BASE, rails: { ...BASE.rails, reservations: true } }, "reservations");
    expect(row.state.kind).toBe("not_mine");
    // _shared/place-rails.ts RAIL_COLUMNS = {mesita_pay, credits, pickup,
    // delivery}. A switch here would post a key the EF loop skips: 200 OK,
    // no write, and an optimistic UI showing it on.
    expect(["on", "off"]).not.toContain(row.state.kind);
  });
});

describe("T4 — a read in flight is not a verdict", () => {
  it("Stripe and Mesita Pay read Checking, never locked, while connect loads", () => {
    const input: LadderInput = { ...BASE, connectLoading: true };
    expect(rowFor(input, "stripe").state.kind).toBe("checking");
    expect(rowFor(input, "mesita_pay").state.kind).toBe("checking");
  });

  it("a non-member still reads locked while loading — partnership outranks it", () => {
    const input: LadderInput = { ...BASE, member: false, connectLoading: true };
    expect(rowFor(input, "stripe").state.kind).toBe("locked");
  });

  it("falls through to the real verdict once the read lands", () => {
    const input: LadderInput = { ...BASE, connect: { kind: "ready" }, connectLoading: false };
    expect(rowFor(input, "stripe").state.kind).toBe("on");
  });
});

describe("T3 — an unread fact is never rendered as false", () => {
  it("reservations reports Unknown, not Off, when the payload omitted it", () => {
    const row = rowFor({ ...BASE, rails: { ...BASE.rails, reservations: null } }, "reservations");
    if (row.state.kind !== "not_mine") throw new Error("expected not_mine");
    expect(row.state.on).toBeNull();
  });
});

describe("first paint — what guests can do, not a zero (MESITA-1739)", () => {
  it("names the live reservation and says nothing else is live", () => {
    const rows = offeringRows({
      ...BASE,
      rails: { ...BASE.rails, reservations: true },
    });
    expect(guestSummary(rows)).toBe(
      "Right now, guests can book a table. Nothing else is live.",
    );
  });

  it("says nothing is live when every guest rail is off", () => {
    expect(guestSummary(offeringRows(BASE))).toBe(
      "Right now, nothing is live for guests.",
    );
  });

  it("drops partnership and stripe from the painted list", () => {
    const keys = paintRows(offeringRows(BASE)).map((r) => r.key);
    expect(keys).not.toContain("partnership");
    expect(keys).not.toContain("stripe");
  });

  it("sorts a disagreement above rows that agree", () => {
    const rows = paintRows(
      offeringRows({
        ...BASE,
        member: false,
        visitRewardsLevel: 2,
        rails: { ...BASE.rails, reservations: true },
      }),
    );
    expect(rows[0].key).toBe("visit_rewards");
    expect(rows[0].disagreement).not.toBeNull();
  });

  it("offers join as the one prerequisite when the place is not a partner", () => {
    const prereq = topPrerequisite({ ...BASE, member: false });
    expect(prereq?.action).toBe("join");
    expect(prereq?.text).toContain("free");
  });

  it("offers Organization for Stripe once the place is a partner without Connect", () => {
    const prereq = topPrerequisite({
      ...BASE,
      member: true,
      connect: { kind: "none" },
      connectLoading: false,
    });
    expect(prereq?.action).toBe("organization");
  });

  it("does not grow a disagreement line when asked and guests-get agree", () => {
    const row = rowFor(BASE, "pickup");
    expect(row.disagreement).toBeNull();
  });

  it("names a ghost-partner hold as the visit-rewards disagreement", () => {
    const row = rowFor(
      { ...BASE, visitRewardsLevel: 2, rewardLaneHeld: true },
      "visit_rewards",
    );
    expect(row.disagreement?.fix).toBe("restore");
  });
});
