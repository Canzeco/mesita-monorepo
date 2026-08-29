import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("Manage Single catalog status columns", () => {
  it("is Created … Promoted then the trailing acceptance bits Mesita Pay · Accepts Yums", () => {
    const src = readFileSync(join(here, "PlaceSelectCatalog.tsx"), "utf8");
    const headers = [
      ...src.matchAll(
        /<th className="px-4 py-3 text-center font-semibold(?: whitespace-nowrap)?">([\w ]+)<\/th>/g,
      ),
    ].map((m) => m[1]);
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
      "Mesita Pay",
      "Accepts Yums",
    ]);
    expect(src).toContain("ActiveCell");
    expect(src).toContain("RequestCountCell");
    expect(src).toContain("place.request_count");
    expect(src).not.toMatch(/BoolCell value=\{place\.requested\}/);
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
    expect(src).toContain("searchOnQuery: false");
    expect(src).toContain("Name Deep Search");
    expect(src).toContain("awaitingHits");
    expect(src).not.toContain("Looking up Google Places");
    expect(src).not.toContain("Not on Mesita");
  });
});

describe("admin-web-search-places ships the acceptance intent bits", () => {
  it("reads them off places (never profiles) and shapes both fact keys", () => {
    const ef = readFileSync(
      join(
        here,
        "../../../../../../supabase/supabase/functions/admin-web-search-places/index.ts",
      ),
      "utf8",
    );
    // The side-read is the admin-only path; the profiles view is anon-readable
    // and must never carry these columns.
    expect(ef).toContain('"id, enrichment, mesita_pay_enabled, yums_enabled"');
    expect(ef).toContain("mesita_pay:");
    expect(ef).toContain("yums:");
    const cols = ef.match(/const cols =\s*"([^"]+)"/)?.[1] ?? "";
    expect(cols).not.toContain("mesita_pay_enabled");
    expect(cols).not.toContain("yums_enabled");
  });
});

describe("admin-web-suggest-places uses Name Deep Search", () => {
  it("calls runConsumerSearchLane in deep mode", () => {
    const ef = readFileSync(
      join(
        here,
        "../../../../../../supabase/supabase/functions/admin-web-suggest-places/index.ts",
      ),
      "utf8",
    );
    expect(ef).toContain("runConsumerSearchLane");
    expect(ef).toContain('mode: typeof body.mode === "string" ? body.mode : "deep"');
    expect(ef).not.toContain('from "../_shared/suggest-places.ts"');
  });
});
