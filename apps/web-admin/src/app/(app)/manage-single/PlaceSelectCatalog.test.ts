import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("Manage Single catalog status columns", () => {
  it("is Created · Active · Listed · Requested · Enriched · Enriching · Verified · Partnered · Promoted", () => {
    const src = readFileSync(join(here, "PlaceSelectCatalog.tsx"), "utf8");
    const headers = [...src.matchAll(/<th className="px-4 py-3 text-center font-semibold">(\w+)<\/th>/g)].map(
      (m) => m[1],
    );
    expect(headers).toEqual([
      "Created",
      "Active",
      "Listed",
      "Requested",
      "Enriched",
      "Enriching",
      "Verified",
      "Partnered",
      "Promoted",
    ]);
    expect(src).toContain("ActiveCell");
    expect(src).toContain("operatorPromotingLevel");
    expect(src).toContain("[1, 2].map");
    expect(src).not.toContain("[1, 2, 3].map");
  });
});

describe("Manage Single search chrome", () => {
  const src = readFileSync(join(here, "PlaceSelectCatalog.tsx"), "utf8");

  it("does not repeat the page title as a Searching eyebrow", () => {
    expect(src).not.toContain("Manage Single Place results");
    expect(src).not.toContain("Google results · Searching");
  });

  it("fits loading and empty states to content — no padded empty sheet", () => {
    expect(src).not.toMatch(/py-12/);
    expect(src).not.toMatch(/min-h-\[70%\]/);
    expect(src).not.toMatch(/h-\[70%\]/);
    expect(src).toContain("Looking up Google Places");
    expect(src).toContain("awaitingHits");
  });
});
