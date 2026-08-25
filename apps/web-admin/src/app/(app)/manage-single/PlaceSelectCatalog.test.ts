import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("Manage Single catalog status columns", () => {
  it("is Created · Active · Listed · Enriched · Verified · Partner · Promoting", () => {
    const src = readFileSync(join(here, "PlaceSelectCatalog.tsx"), "utf8");
    const headers = [...src.matchAll(/<th className="px-4 py-3 text-center font-semibold">(\w+)<\/th>/g)].map(
      (m) => m[1],
    );
    expect(headers).toEqual([
      "Created",
      "Active",
      "Listed",
      "Enriched",
      "Verified",
      "Partner",
      "Promoting",
    ]);
    expect(src).toContain("ActiveCell");
  });
});
