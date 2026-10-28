// Single Place › Find reads Discovery › Word by Admin (MESITA-2322).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_NAME_ADMIN } from "../filters-config/catalog";

const read = (f: string) => readFileSync(join(__dirname, f), "utf8");

describe("Find's caps come from Word by Admin", () => {
  it("defaults are Find's behaviour before the knobs: no Autocomplete, 20 Text Search, catalogue on empty", () => {
    expect(DEFAULT_NAME_ADMIN).toEqual({
      autoCount: 0,
      textCount: 20,
      emptyQuery: true,
    });
  });

  it("the page seeds the client from the blob; the client reads each cap", () => {
    expect(read("page.tsx")).toContain("discovery.config.name.admin");
    const client = read("SinglePlaceClient.tsx");
    expect(client).toContain("searchTextSource(query, findCaps.textCount)");
    expect(client).toContain("findCaps.autoCount > 0");
    expect(client).toContain("if (findCaps.emptyQuery) void findCatalogue();");
  });
});
