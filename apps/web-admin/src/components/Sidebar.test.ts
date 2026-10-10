import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONFIGURATIONS_NAV } from "./Sidebar";

const APP = join(__dirname, "..", "app", "(app)");

// Pato, MESITA-2083: "Models, Creation, Enrichment, Discovery, Reservations —
// Only those". Order and count are the instruction.
describe("Configurations rail", () => {
  it("is exactly Models · Creation · Enrichment · Discovery · Reservations", () => {
    expect(CONFIGURATIONS_NAV.map((i) => i.label)).toEqual([
      "Models",
      "Creation",
      "Enrichment",
      "Discovery",
      "Reservations",
    ]);
  });

  it("gives each row its own page, so exactly one row lights", () => {
    const hrefs = CONFIGURATIONS_NAV.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    // isNavActive is a prefix match: no row's href may prefix another's.
    for (const a of hrefs)
      for (const b of hrefs)
        if (a !== b) expect(b.startsWith(`${a}/`), `${a} lights on ${b}`).toBe(false);
    for (const href of ["/enricher-config/creation", "/enricher-config/enrichment"])
      expect(existsSync(join(APP, ...href.split("/").filter(Boolean), "page.tsx")), href).toBe(true);
  });
});
