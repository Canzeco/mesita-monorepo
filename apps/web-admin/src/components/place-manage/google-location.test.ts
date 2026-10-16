import { describe, expect, it } from "vitest";
import { googleFormattedAddress } from "./google-location";

describe("googleFormattedAddress", () => {
  it("reads formattedAddress and ignores the component keys", () => {
    expect(
      googleFormattedAddress({
        formattedAddress: "  Av. Ámsterdam 1, CDMX  ",
        location: { latitude: 19.4, longitude: -99.16 },
        addressComponents: [
          { types: ["neighborhood", "political"], longText: "Condesa" },
          { types: ["locality", "political"], longText: "Ciudad de México" },
        ],
      }),
    ).toBe("Av. Ámsterdam 1, CDMX");
  });

  it("does not invent an address from components or coordinates", () => {
    expect(
      googleFormattedAddress({
        location: { latitude: 19.4, longitude: -99.16 },
        addressComponents: [
          { types: ["locality", "political"], longText: "Ciudad de México" },
        ],
      }),
    ).toBeNull();
    expect(googleFormattedAddress(null)).toBeNull();
    expect(googleFormattedAddress("Colonia Condesa")).toBeNull();
  });
});
