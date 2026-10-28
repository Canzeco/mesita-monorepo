import { describe, expect, it } from "vitest";
import { classifyLookup } from "./single-place-lookup";

const GID = "ChIJN1t_tDeuEmsRUsoyG83frY4";

describe("classifyLookup", () => {
  it("reads one Place ID token as a Google Place ID", () => {
    expect(classifyLookup(`  ${GID} `)).toEqual({ kind: "google_place_id", id: GID });
  });
  it("reads words, or a token beside words, as a name", () => {
    expect(classifyLookup("Café Nin")).toEqual({ kind: "name", query: "Café Nin" });
    expect(classifyLookup(`Café ${GID}`)).toEqual({ kind: "name", query: `Café ${GID}` });
  });
  it("never reads a Mesita uuid as a Google Place ID", () => {
    const uuid = "00000000-0000-4000-8000-000000000001";
    expect(classifyLookup(uuid)).toEqual({ kind: "name", query: uuid });
  });
  it("is empty on blank", () => {
    expect(classifyLookup("   ")).toEqual({ kind: "empty" });
  });
});
