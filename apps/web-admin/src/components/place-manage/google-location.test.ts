import { describe, expect, it } from "vitest";
import { googleLocationEntries } from "./google-location";

describe("googleLocationEntries", () => {
  it("keeps Google's keys and does not invent a missing component", () => {
    const pairs = googleLocationEntries({
      formattedAddress: "Av. Ámsterdam 1, CDMX",
      location: { latitude: 19.4, longitude: -99.16 },
      addressComponents: [
        { types: ["neighborhood", "political"], longText: "Condesa" },
        { types: ["locality", "political"], longText: "Ciudad de México" },
      ],
    });
    expect(pairs.map((pair) => pair.key)).toEqual([
      "formattedAddress",
      "neighborhood",
      "locality",
      "location.latitude",
      "location.longitude",
    ]);
    expect(pairs.find((pair) => pair.key === "neighborhood")?.value).toBe("Condesa");
    expect(pairs.some((pair) => pair.key === "sublocality")).toBe(false);
    expect(pairs.some((pair) => pair.key === "city" || pair.key === "zone")).toBe(false);
  });

  it("does not parse formattedAddress into components", () => {
    const pairs = googleLocationEntries({
      formattedAddress: "Colonia Condesa, Ciudad de México",
    });
    expect(pairs).toEqual([
      { key: "formattedAddress", value: "Colonia Condesa, Ciudad de México" },
    ]);
  });
});
