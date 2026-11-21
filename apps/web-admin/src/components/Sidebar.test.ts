import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTIVITY_NAV, CONFIGURATIONS_NAV, EXTRA_NAV, MANAGE_NAV } from "./Sidebar";

const APP = join(__dirname, "..", "app", "(app)");

// Models, then Atlas, then the MESITA-2083 order.
describe("Configurations rail", () => {
  it("is exactly Models · Atlas · Creation · Updation · Discovery · Reservations · Payments · Stories", () => {
    expect(CONFIGURATIONS_NAV.map((i) => i.label)).toEqual([
      "Models",
      "Atlas",
      "Creation",
      "Updation",
      "Discovery",
      "Reservations",
      "Payments",
      "Stories",
    ]);
  });

  it("gives each row its own page, so exactly one row lights", () => {
    const hrefs = CONFIGURATIONS_NAV.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    // isNavActive is a prefix match: no row's href may prefix another's.
    for (const a of hrefs)
      for (const b of hrefs)
        if (a !== b) expect(b.startsWith(`${a}/`), `${a} lights on ${b}`).toBe(false);
    for (const href of ["/enricher-config/creation", "/enricher-config/uprich", "/families"])
      expect(existsSync(join(APP, ...href.split("/").filter(Boolean), "page.tsx")), href).toBe(true);
  });
});

// Pato, MESITA-2084, on the rail with Places highlighted: "Multiple Places /
// Single Place". Many then one, after the two wider records.
describe("Activity rail", () => {
  it("is exactly Logs · Feedback", () => {
    expect(ACTIVITY_NAV.map((i) => i.label)).toEqual(["Logs", "Feedback"]);
  });

  it("gives each row its own page", () => {
    const hrefs = ACTIVITY_NAV.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of ["/logs", "/feedback"])
      expect(existsSync(join(APP, ...href.split("/").filter(Boolean), "page.tsx")), href).toBe(true);
  });
});

describe("Extra rail", () => {
  it("is exactly Ping · Story · Cost", () => {
    expect(EXTRA_NAV.map((i) => i.label)).toEqual(["Ping", "Story", "Cost"]);
    expect(EXTRA_NAV.map((i) => i.href)).toEqual(["/billing-test", "/story-test", "/cost"]);
  });

  it("gives each row its own page, and Story does not light Stories or Ping", () => {
    const hrefs = [...EXTRA_NAV.map((i) => i.href), "/stories-config"];
    for (const a of hrefs)
      for (const b of hrefs)
        if (a !== b) expect(b.startsWith(`${a}/`), `${a} lights on ${b}`).toBe(false);
    for (const href of EXTRA_NAV.map((i) => i.href))
      expect(existsSync(join(APP, ...href.split("/").filter(Boolean), "page.tsx")), href).toBe(true);
  });
});

describe("Manage rail", () => {
  it("is exactly Admins · Database · Multiple Places · Single Place · Reservations", () => {
    expect(MANAGE_NAV.map((i) => i.label)).toEqual([
      "Admins",
      "Database",
      "Multiple Places",
      "Single Place",
      "Reservations",
    ]);
  });

  it("gives each row its own page, so exactly one row lights", () => {
    const hrefs = MANAGE_NAV.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const a of hrefs)
      for (const b of hrefs)
        if (a !== b) expect(b.startsWith(`${a}/`), `${a} lights on ${b}`).toBe(false);
    for (const href of ["/manage-multiple", "/manage-single", "/manage-reservations"])
      expect(existsSync(join(APP, ...href.split("/").filter(Boolean), "page.tsx")), href).toBe(true);
  });
});
