import { describe, expect, it } from "vitest";
import type { PlacePremier } from "@/lib/business-api";
import { day } from "@/lib/format";
import { shownLevel, statusLine } from "@/lib/plans";

// The Premier status line states what a place pays for and until when
// (MESITA-3632): billing wording, so every case is pinned (MVP money rule).

const BASE: PlacePremier = {
  role: "owner",
  tier: 0,
  manual: null,
  paid: null,
  renewing: false,
  viewer: null,
  can_resume: false,
  mine: null,
  quotes: null,
};
const MAR = "2027-03-04T18:00:00Z";
const JAN = "2027-01-15T18:00:00Z";
const DEC = "2026-12-01T18:00:00Z";
const pro = (o: Partial<NonNullable<PlacePremier["paid"]>> = {}) => ({ tier: 1, ends_at: MAR, renews: true, by_you: true, ...o });
const mine = (interval: "month" | "year") => ({ id: "m1", tier: 1, interval, status: "ready" as const, pending: null, has_card: true, checkout: null });
const at = (o: Partial<PlacePremier>): PlacePremier => ({ ...BASE, ...o });

describe("statusLine", () => {
  const rows: Array<[string, PlacePremier, string]> = [
    ["Free", at({}), "Free plan"],
    ["plan renews", at({ paid: pro() }), "Pro plan · renews Mar 4, 2027"],
    ["monthly payer", at({ paid: pro(), mine: mine("month") }), "Pro plan · monthly · renews Mar 4, 2027"],
    ["monthly not shown to a non-payer", at({ paid: pro({ by_you: false }), mine: mine("month") }), "Pro plan · renews Mar 4, 2027"],
    ["renewal being charged", at({ paid: pro(), renewing: true }), "Pro plan · renewal being charged"],
    ["plan ends", at({ paid: pro({ renews: false }) }), "Pro plan · ends Mar 4, 2027"],
    ["Upgrade only, admin", at({ manual: { tier: 1, ends_at: JAN, source: "admin" } }), "Given by Mesita · until Jan 15, 2027"],
    ["Upgrade only, purchase", at({ manual: { tier: 1, ends_at: JAN, source: "purchase" } }), "Bought by a guest · until Jan 15, 2027"],
    ["Upgrade, missing source", at({ manual: { tier: 1, ends_at: JAN } }), "Given by Mesita · until Jan 15, 2027"],
    ["Upgrade above a renewing plan", at({ paid: pro(), manual: { tier: 2, ends_at: DEC, source: "purchase" } }), "Bought by a guest · until Dec 1, 2026 · then Pro plan"],
    ["Upgrade above a plan ending first", at({ paid: pro({ renews: false, ends_at: DEC }), manual: { tier: 2, ends_at: JAN, source: "admin" } }), "Given by Mesita · until Jan 15, 2027 · then Free plan"],
    ["Upgrade equal to the plan", at({ paid: pro(), manual: { tier: 1, ends_at: JAN, source: "admin" } }), "Pro plan · renews Mar 4, 2027"],
    ["plan above the Upgrade", at({ paid: { ...pro(), tier: 2 }, manual: { tier: 1, ends_at: JAN } }), "Max plan · renews Mar 4, 2027"],
    ["Upgrade over a guest-paid plan", at({ paid: pro({ by_you: false }), manual: { tier: 2, ends_at: DEC, source: "admin" } }), "Given by Mesita · until Dec 1, 2026 · then Pro plan"],
    ["invalid plan date", at({ paid: pro({ ends_at: "nope" }) }), "Pro plan"],
    ["invalid Upgrade date", at({ paid: pro(), manual: { tier: 2, ends_at: "nope" } }), "Pro plan · renews Mar 4, 2027"],
  ];
  it.each(rows)("%s", (_name, p, line) => {
    expect(statusLine(p)).toBe(line);
  });
});

describe("shownLevel", () => {
  it("is the higher of plan and Upgrade, even when the stored tier lags", () => {
    expect(shownLevel(at({ tier: 0, paid: pro(), manual: { tier: 2, ends_at: JAN } }))).toBe(2);
    expect(shownLevel(at({ tier: 2 }))).toBe(0);
  });
});

describe("day", () => {
  it("prints the Monterrey date, not the UTC one", () => {
    expect(day("2027-03-05T03:00:00Z")).toBe("Mar 4, 2027");
    expect(day("not a date")).toBe("");
  });
});
