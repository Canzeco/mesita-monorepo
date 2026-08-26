import { describe, expect, it } from "vitest";
import { PARTNER_PERKS } from "./perks";

describe("PARTNER_PERKS", () => {
  it("is seven rows, Listed vs Partner, no rank-for-sale row", () => {
    expect(PARTNER_PERKS.map((r) => r.id)).toEqual([
      "listed",
      "discounts",
      "badge",
      "visibility",
      "reservationist",
      "performance",
      "switch",
    ]);
    expect(PARTNER_PERKS.some((r) => /rank/i.test(r.label))).toBe(false);
    expect(PARTNER_PERKS[0]?.listed).toBe("yes");
    expect(PARTNER_PERKS[0]?.partner).toBe("yes");
    expect(PARTNER_PERKS.filter((r) => r.listed === "no")).toHaveLength(6);
  });
});
