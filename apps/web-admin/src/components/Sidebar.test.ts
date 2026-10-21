import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONFIGURATIONS_NAV, MANAGE_NAV } from "./Sidebar";

const APP = join(__dirname, "..", "app", "(app)");

// Models, then Atlas, then the MESITA-2083 order.
describe("Configurations rail", () => {
  it("is exactly Models · Atlas · Creation · Enrichment · Discovery · Reservations", () => {
    expect(CONFIGURATIONS_NAV.map((i) => i.label)).toEqual([
      "Models",
      "Atlas",
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
    for (const href of ["/enricher-config/creation", "/enricher-config/enrichment", "/families"])
      expect(existsSync(join(APP, ...href.split("/").filter(Boolean), "page.tsx")), href).toBe(true);
  });
});

// Pato, MESITA-2084, on the rail with Places highlighted: "Multiple Places /
// Single Place". Many then one, after the two wider records.
describe("Manage rail", () => {
  it("is exactly Admins · Guests · Database · Multiple Places · Single Place", () => {
    expect(MANAGE_NAV.map((i) => i.label)).toEqual([
      "Admins",
      "Guests",
      "Database",
      "Multiple Places",
      "Single Place",
    ]);
  });

  it("gives each row its own page, so exactly one row lights", () => {
    const hrefs = MANAGE_NAV.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const a of hrefs)
      for (const b of hrefs)
        if (a !== b) expect(b.startsWith(`${a}/`), `${a} lights on ${b}`).toBe(false);
    for (const href of ["/guests", "/manage-multiple", "/manage-single"])
      expect(existsSync(join(APP, ...href.split("/").filter(Boolean), "page.tsx")), href).toBe(true);
  });
});
