import { describe, expect, it } from "vitest";
import type { PlaceHit } from "@/app/(app)/manage-multiple/actions";
import {
  classifyLookup,
  filterCatalog,
  MAX_NAME_MATCHES,
  matchesPlace,
} from "./single-place-lookup";

const GID = "ChIJN1t_tDeuEmsRUsoyG83frY4";

function hit(over: Partial<PlaceHit>): PlaceHit {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Café Nin",
    google_name: "Cafe Nin",
    address: "Calle Havre 73, Juárez",
    slug: "cafe-nin",
    ...over,
  } as PlaceHit;
}

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

describe("matchesPlace", () => {
  it("ignores case and accents across name, google name, address and slug", () => {
    const h = hit({});
    expect(matchesPlace(h, "cafe")).toBe(true);
    expect(matchesPlace(h, "JUAREZ")).toBe(true);
    expect(matchesPlace(h, "cafe-nin")).toBe(true);
    expect(matchesPlace(h, "taquería")).toBe(false);
  });
  it("matches nothing on a blank query", () => {
    expect(matchesPlace(hit({}), "  ")).toBe(false);
  });
});

describe("filterCatalog", () => {
  it(`caps at ${MAX_NAME_MATCHES}`, () => {
    const many = Array.from({ length: MAX_NAME_MATCHES + 5 }, (_, i) =>
      hit({ id: `id-${i}`, name: `Café ${i}` }),
    );
    expect(filterCatalog(many, "café")).toHaveLength(MAX_NAME_MATCHES);
  });
});
