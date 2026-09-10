// What PLACE_CAPABILITIES must keep true (MESITA-1735).
//
// EVERY EXPECTATION HERE IS A LITERAL. That is not style — it is the whole
// point. `shell-chrome.test.ts` once built its expected value by calling the
// same function it was testing, so it re-checked a route that existed while
// the real one 404'd, and stayed green for months. A contract test that reads
// its answer off the thing under test cannot fail.
//
// So: the labels below are typed out from Notion Main §11.2, and the column
// names are typed out from `_shared/place-rails.ts`'s RAIL_COLUMNS. Two
// packages, two runtimes, no import path between them — the restatement IS
// the contract, exactly like `promotion-score.ts` and its Edge Function twin.
import { describe, expect, it } from "vitest";
import {
  CAPABILITY_WRITER_WORD,
  PLACE_CAPABILITIES,
  PLACE_CAPABILITY_COUNT,
  capabilityColumn,
} from "./state-vocabulary";

/** Verbatim from supabase/functions/_shared/place-rails.ts RAIL_COLUMNS.
 *  Keep in lockstep; a key here that the EF does not know is a 200 OK that
 *  writes nothing. */
const RAIL_COLUMNS_TWIN = [
  "mesita_pay_enabled",
  "credits_enabled",
  "pickup_orders_enabled",
  "delivery_orders_enabled",
] as const;

describe("T1 — the labels are Notion Main §11.2's words", () => {
  it("names each capability exactly as the spec does", () => {
    const bySpec = new Map(
      PLACE_CAPABILITIES.filter((c) => c.spec != null).map((c) => [c.spec, c.label]),
    );
    // §11.2, typed out. #2 "Visits Enabled" and #6 "Third-Party Delivery
    // Orders Enabled" are deliberately absent — see the absence test below.
    expect(bySpec.get(1)).toBe("Mesita Pay");
    expect(bySpec.get(3)).toBe("Visits Rewards");
    expect(bySpec.get(4)).toBe("Pickup Orders");
    expect(bySpec.get(5)).toBe("Delivery Orders");
    expect(bySpec.get(7)).toBe("Reservations");
  });

  it("carries six capabilities, and every one has a detail sentence", () => {
    expect(PLACE_CAPABILITY_COUNT).toBe(6);
    for (const c of PLACE_CAPABILITIES) {
      expect(c.detail.length).toBeGreaterThan(10);
      expect(c.label).not.toBe("");
    }
  });

  it("invents no capability the spec and the schema both lack", () => {
    const keys = PLACE_CAPABILITIES.map((c) => c.key);
    // `visits_enabled` has no column anywhere, and
    // business-web-list-places/payload.test.ts fences it as "the draft
    // taxonomy's inventions". Adding it here would silently delete that guard.
    expect(keys).not.toContain("visits");
    // 1P/3P is one unbuilt intent bit, not two. Main §2.3.7 strikes
    // First-Party through and §8 files Third-Party under Future Expansions.
    expect(keys).not.toContain("third_party_delivery");
    expect(keys).not.toContain("first_party_delivery");
  });
});

describe("T2 — bijection: a switch exists exactly where a column does", () => {
  // FORWARD: nothing claims a column the rails EF cannot write.
  it("every capability column is a column the rails EF writes", () => {
    for (const c of PLACE_CAPABILITIES) {
      if (c.column == null) continue;
      if (c.key === "reservations") continue; // read-only; asserted below
      expect(RAIL_COLUMNS_TWIN).toContain(c.column);
    }
  });

  // REVERSE: nothing the rails EF writes is missing from the vocabulary.
  // A forward-only loop is what let shell-chrome.test.ts pass while broken.
  it("every column the rails EF writes belongs to a capability", () => {
    const declared = PLACE_CAPABILITIES.filter((c) => c.writer === "declared").map(
      (c) => c.column,
    );
    for (const col of RAIL_COLUMNS_TWIN) {
      expect(declared).toContain(col);
    }
  });

  it("reservations has a column but is NOT writable from here", () => {
    // The asymmetry that caused the bug: the column exists and the consumer
    // app reads it, but RAIL_COLUMNS has no key for it and the only writer is
    // the Intaker. Observed, therefore no switch.
    expect(capabilityColumn("reservations")).toBe("reservations_enabled");
    expect(RAIL_COLUMNS_TWIN).not.toContain("reservations_enabled");
    const row = PLACE_CAPABILITIES.find((c) => c.key === "reservations");
    expect(row?.writer).toBe("observed");
  });

  it("a capability with no column names who does set it", () => {
    for (const c of PLACE_CAPABILITIES) {
      if (c.writer === "declared") continue;
      // Never "Soon": a ship date is not something an operator can act on.
      expect(CAPABILITY_WRITER_WORD[c.writer]).not.toBe("");
      expect(CAPABILITY_WRITER_WORD[c.writer]).not.toMatch(/soon/i);
    }
  });
});
