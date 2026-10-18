import { describe, expect, it } from "vitest";

import { readCardsPerScreen } from "@/components/consumer/home/CatalogRails";

describe("the cards-per-screen slider value (MESITA-2356)", () => {
  it("reads a stored stop or any value between", () => {
    expect(readCardsPerScreen("2.5")).toBe(2.5);
    expect(readCardsPerScreen("1.75")).toBe(1.75);
    expect(readCardsPerScreen("2.35")).toBe(2.35);
  });

  it("clamps to 1.25–3 and falls back to 2.5 on junk", () => {
    expect(readCardsPerScreen("0.5")).toBe(1.25);
    expect(readCardsPerScreen("9")).toBe(3);
    expect(readCardsPerScreen("")).toBe(2.5);
    expect(readCardsPerScreen("big")).toBe(2.5);
  });
});
