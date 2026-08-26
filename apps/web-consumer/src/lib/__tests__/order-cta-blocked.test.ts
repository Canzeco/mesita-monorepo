// Order CTAs stay blocked until the orders vertical exists.
//
// Pato: by default every Order button is locked — the same treatment as Visit
// on a non-partner. A tappable coming-soon modal reads as a live feature that
// failed. These tests pin the contract in the two surfaces that offer the
// three verbs (place-detail bar + swipe Go sheet) so a "helpful" un-park
// cannot silently re-enable the tap.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ORDER_BLOCKED } from "@/components/consumer/place-detail/place-actions-copy";

const DIR = join(__dirname, "../../components/consumer/place-detail");
const read = (file: string) => readFileSync(join(DIR, file), "utf8");

describe("ORDER_BLOCKED is the one parked-Order sentence", () => {
  it("tells the guest ordering is not live, without promising a date", () => {
    expect(ORDER_BLOCKED.aria).toBe("Ordering isn't available yet");
    expect(ORDER_BLOCKED.title).toBe("Ordering isn't live on Mesita yet.");
    expect(ORDER_BLOCKED.hint).toBe("Ordering isn't live yet.");
  });
});

describe("the place-detail bar locks Order", () => {
  const src = read("PlaceActionBar.tsx");

  it("does not open a coming-soon modal", () => {
    expect(src).not.toContain("ComingSoonModal");
    expect(src).not.toContain("setOrderSoon");
  });

  it("renders Order disabled, with the lock treatment", () => {
    const order = src.slice(src.indexOf("ORDER — blocked"));
    const reserve = order.indexOf("RESERVE");
    const block = reserve === -1 ? order : order.slice(0, reserve);
    expect(block).toContain("disabled");
    expect(block).toContain("ORDER_BLOCKED");
    expect(block).toContain("Lock");
    expect(block).not.toContain("onClick");
  });
});

describe("the swipe Go sheet locks Order", () => {
  const src = read("GoSheet.tsx");

  it("does not open a coming-soon modal", () => {
    expect(src).not.toContain("ComingSoonModal");
    expect(src).not.toContain("setOrderSoon");
  });

  it("renders the Order row disabled, with the lock treatment", () => {
    const order = src.slice(src.indexOf("ORDER — blocked"));
    const reserve = order.indexOf("CalendarCheck");
    const block = reserve === -1 ? order : order.slice(0, reserve);
    expect(block).toContain("disabled");
    expect(block).toContain("ORDER_BLOCKED.hint");
    expect(block).toContain("Icon={Lock}");
    expect(block).not.toContain("onClick");
  });
});
