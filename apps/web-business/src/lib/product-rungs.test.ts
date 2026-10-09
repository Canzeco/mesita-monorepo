import { describe, expect, it } from "vitest";
import { buildProductCards, PRODUCT_ORDER } from "./products";
import { placeTabHref } from "./place-tabs";
import { placePayHref } from "./console-routes";
import type { ConsolePlace } from "@/lib/api/console";
import { planMeetsMin, type PlacePlanTier } from "./plan-ladder";

function place(over: Partial<ConsolePlace> = {}): ConsolePlace {
  return {
    id: "p-1",
    name: "Strana",
    address: null,
    zone: null,
    claimedAt: null,
    ...over,
  };
}

function minPlanFor(key: string): PlacePlanTier | null {
  const cards = buildProductCards({
    partnered: false,
    placePlan: "free",
    mesitaPayEnabled: false,
    place: place(),
    placeHref: (v) => placeTabHref("p-1", v),
    payHref: placePayHref("p-1"),
  });
  const card = cards.find((c) => c.key === key);
  if (!card) throw new Error(`missing product ${key}`);
  if (card.state !== "locked") return null;
  const note = card.note ?? "";
  if (note.includes("Ultra")) return "ultra";
  if (note.includes("Pro")) return "pro";
  return "free";
}

describe("product rungs (MESITA-2020)", () => {
  it("Online Orders may never sit below Online Payments", () => {
    expect(minPlanFor("pay")).toBe("pro");
    expect(minPlanFor("orders")).toBe("pro");
    expect(planMeetsMin("pro", "pro")).toBe(true);
  });

  it("every gated product appears in catalogue order", () => {
    for (const key of ["visits", "orders", "pay", "credits"] as const) {
      expect(PRODUCT_ORDER).toContain(key);
      expect(minPlanFor(key)).not.toBeNull();
    }
  });
});
