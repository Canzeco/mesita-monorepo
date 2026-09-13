import { describe, expect, it } from "vitest";
import { balanceFace, spendableAtCopy } from "@/lib/credits";

// MESITA-1816. The organization is the money boundary; the FACE is the place
// while the organization holds exactly one. Literal expectations, typed out.
const taqueria = { id: "p1", name: "Taquería X", photoUrl: "https://x/p1.jpg" };

describe("balanceFace", () => {
  it("a one-place organization wears its place: name and photo", () => {
    expect(balanceFace({ organizationName: "Grupo X", placeCount: 1, place: taqueria })).toEqual({
      name: "Taquería X",
      photoUrl: "https://x/p1.jpg",
      isPlace: true,
    });
  });

  it("two or more places: the organization, and no art of its own", () => {
    expect(balanceFace({ organizationName: "Grupo X", placeCount: 3, place: null })).toEqual({
      name: "Grupo X",
      photoUrl: null,
      isPlace: false,
    });
  });

  it("no place today (released after the purchase): still the organization", () => {
    expect(balanceFace({ organizationName: "Grupo X", placeCount: 0, place: null }).name).toBe(
      "Grupo X",
    );
  });

  it("never trusts a place without the count agreeing", () => {
    // A server that sent `place` alongside placeCount 2 is a bug; the card
    // must not present one branch as the whole organization.
    expect(balanceFace({ organizationName: "Grupo X", placeCount: 2, place: taqueria }).isPlace).toBe(
      false,
    );
  });
});

describe("spendableAtCopy", () => {
  it("names the place, the organization's N places, or the organization alone", () => {
    expect(spendableAtCopy({ organizationName: "Grupo X", placeCount: 1, place: taqueria })).toBe(
      "Spendable at Taquería X",
    );
    expect(spendableAtCopy({ organizationName: "Grupo X", placeCount: 3, place: null })).toBe(
      "Spendable at any of Grupo X's 3 places",
    );
    expect(spendableAtCopy({ organizationName: "Grupo X", placeCount: 0, place: null })).toBe(
      "Spendable at Grupo X",
    );
  });
});
