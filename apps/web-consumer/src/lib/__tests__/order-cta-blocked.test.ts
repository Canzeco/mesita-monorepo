// Order / Reserve CTAs follow Description → Actions flags.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ORDER_BLOCKED,
  RESERVE_BLOCKED,
} from "@/components/consumer/place-detail/place-actions-copy";

const DIR = join(__dirname, "../../components/consumer/place-detail");
const read = (file: string) => readFileSync(join(DIR, file), "utf8");

describe("ORDER_BLOCKED copy", () => {
  it("explains missing menu, not a global coming-soon", () => {
    expect(ORDER_BLOCKED.aria).toBe("Ordering isn't available at this place yet");
    expect(ORDER_BLOCKED.title).toContain("menu");
  });
});

describe("RESERVE_BLOCKED copy", () => {
  it("explains walk-in venues", () => {
    expect(RESERVE_BLOCKED.hint).toContain("Walk-in");
  });
});

describe("PlaceActionBar gates Order and Reserve", () => {
  const src = read("PlaceActionBar.tsx");

  it("does not open a coming-soon modal", () => {
    expect(src).not.toContain("ComingSoonModal");
  });

  it("reads orders_enabled via isOrderActionEnabled", () => {
    expect(src).toContain("isOrderActionEnabled");
    expect(src).toContain("orderEnabled");
  });

  it("reads reservations_enabled via isReserveActionEnabled", () => {
    expect(src).toContain("isReserveActionEnabled");
    expect(src).toContain("reserveEnabled");
  });
});

describe("GoSheet gates Order and Reserve", () => {
  const src = read("GoSheet.tsx");

  it("does not open a coming-soon modal", () => {
    expect(src).not.toContain("ComingSoonModal");
  });

  it("uses the same action helpers", () => {
    expect(src).toContain("isOrderActionEnabled");
    expect(src).toContain("isReserveActionEnabled");
  });
});
