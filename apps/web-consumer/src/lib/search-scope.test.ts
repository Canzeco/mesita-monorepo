import { describe, expect, it } from "vitest";

import {
  countryBarChip,
  countryChip,
  countryFlag,
  countryLabel,
  DEFAULT_SEARCH_COUNTRY,
  parseSearchCountry,
} from "@/lib/search-scope";

describe("search scope country", () => {
  it("defaults the product country to Any", () => {
    expect(DEFAULT_SEARCH_COUNTRY).toBeNull();
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

  it("puts a flag on every country pill and keeps Any as the unset default", () => {
    expect(countryFlag("MX")).toBe("🇲🇽");
    expect(countryFlag("US")).toBe("🇺🇸");
    expect(countryFlag(null)).toBe("🌐");
    expect(countryChip(null)).toBe("🌐 Any");
    expect(countryChip("MX")).toBe("🇲🇽 MX");
    expect(countryBarChip(null)).toBe("🌐");
    expect(countryBarChip("MX")).toBe("🇲🇽 MX");
  });
});
