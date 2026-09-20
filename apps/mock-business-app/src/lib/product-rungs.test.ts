// WHAT A RUNG MAY NOT DO TO ITS NEIGHBOURS (MESITA-2019).
//
// `minPlan` reads like a free choice per product, and for most of the
// catalogue it is. Three entries are not: Online Orders, Prepaid Credits and
// Visit Rewards all move a guest's money, and the thing that moves it is
// Online Payments. Pato named it when the packing put Orders on Mesita Pro and
// left Payments above it: *"online orders cannot work without online
// payments."*
//
// IT SHIPS GREEN EITHER WAY, which is the whole reason this file exists. A
// place on a rung with Orders and without Payments gets a catalogue card that
// says On, a view that renders, and an order button that cannot charge
// anybody — no type error, no failing assertion, nothing to see until a guest
// tries to pay. The dependency is a fact about the products, so it is pinned
// against the products.
//
// IT IS AN INEQUALITY, NOT AN EQUALITY. Payments may sit BELOW its dependants
// — that is just a cheaper rung carrying the rail — and it does today: Orders
// and Payments are both Mesita Pro while Credits and Visit Rewards are Ultra.
// Pinning them equal would fail the moment either one moved for a reason that
// has nothing to do with this.
import { describe, expect, it } from "vitest";
import { SPECS } from "./products";
import { PLAN_LADDER, PLAN_RANK, type PlanTier } from "@/mock/types";

const rung = (key: string): PlanTier => SPECS.find((s) => s.key === key)!.minPlan;

describe("the rails a product needs", () => {
  it.each(["orders", "credits", "visits"])(
    "%s never sits below Online Payments",
    (key) => {
      expect(PLAN_RANK[rung(key)]).toBeGreaterThanOrEqual(PLAN_RANK[rung("pay")]);
    },
  );
});

describe("the ladder", () => {
  it("is three rungs, cheapest first", () => {
    expect(PLAN_LADDER).toEqual(["free", "pro", "ultra"]);
  });

  it("puts every product on a rung the ladder has", () => {
    for (const spec of SPECS) expect(PLAN_LADDER).toContain(spec.minPlan);
  });
});
