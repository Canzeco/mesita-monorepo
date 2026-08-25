import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PLACE_TAB_SECTIONS,
  isSectionSoon,
} from "./nav";

const here = dirname(fileURLToPath(import.meta.url));

describe("PLACE_TAB_SECTIONS", () => {
  it("unparks Promos and keeps Performance Soon", () => {
    const byId = Object.fromEntries(
      PLACE_TAB_SECTIONS.map((s) => [s.id, s]),
    );
    expect(byId.promos?.soon).toBe(false);
    expect(byId.performance?.soon).toBe(true);
    expect(isSectionSoon("promos")).toBe(false);
    expect(isSectionSoon("performance")).toBe(true);
  });
});

describe("PromosSection visit-only", () => {
  it("does not edit orders or prepaid", () => {
    const src = readFileSync(
      join(here, "sections/PromosSection.tsx"),
      "utf8",
    );
    expect(src).toMatch(/Visit rewards only — orders and prepaid stay off/);
    expect(src).not.toMatch(/matrix\.orders/);
  });
});
