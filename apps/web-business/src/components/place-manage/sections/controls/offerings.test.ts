import { describe, expect, it } from "vitest";
import { offeringRows, type LadderInput } from "./offerings";

const BASE: LadderInput = {
  member: true,
  visitRewardsLevel: 0,
  rails: { mesita_pay: false, credits: false, pickup: false, delivery: false },
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
