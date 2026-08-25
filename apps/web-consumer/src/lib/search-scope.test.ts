import { describe, expect, it } from "vitest";

import {
  countryLabel,
  DEFAULT_SEARCH_COUNTRY,
  parseSearchCountry,
} from "@/lib/search-scope";

describe("search scope country", () => {
  it("defaults the product country to MX", () => {
    expect(DEFAULT_SEARCH_COUNTRY).toBe("MX");
  });

  it("accepts a two-letter code and treats empty as unset", () => {
    expect(parseSearchCountry("mx")).toBe("MX");
    expect(parseSearchCountry("")).toBeNull();
    expect(parseSearchCountry("Mexico")).toBeNull();
    expect(parseSearchCountry(null)).toBeNull();
  });

  it("labels MX and Any", () => {
    expect(countryLabel("MX")).toBe("Mexico");
    expect(countryLabel(null)).toBe("Any");
  });
});
