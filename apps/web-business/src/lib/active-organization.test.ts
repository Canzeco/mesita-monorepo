// Where `/` lands (MESITA-1807, Pato D3 2026-09-12), over the whole grid, and
// the source contract that the root page forwards its query and answers a
// Stripe return before any place is considered.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pickPlace, resolveLanding } from "./active-organization";

type Org = { id: string; places: { id: string; name: string; photoUrl: null }[] };
const org = (id: string, ...places: string[]): Org => ({
  id,
  places: places.map((p) => ({ id: p, name: p, photoUrl: null })),
});

describe("resolveLanding", () => {
  const A = org("a", "p-1", "p-2");
  const B = org("b");
  const C = org("c", "p-3");

  it("lands on the last place opened, searched across every organization", () => {
    expect(
      resolveLanding({ organizations: [A, B, C], rememberedPlaceId: "p-3", rememberedOrgId: "a" }),
    ).toEqual({ kind: "place", placeId: "p-3" });
  });

  it("a released or foreign remembered place falls through to the organization", () => {
    expect(
      resolveLanding({ organizations: [A, B], rememberedPlaceId: "gone", rememberedOrgId: null }),
    ).toEqual({ kind: "place", placeId: "p-1" });
  });

  it("the remembered organization's first place, else its Overview", () => {
    expect(
      resolveLanding({ organizations: [A, B, C], rememberedPlaceId: null, rememberedOrgId: "c" }),
    ).toEqual({ kind: "place", placeId: "p-3" });
    expect(
      resolveLanding({ organizations: [A, B], rememberedPlaceId: null, rememberedOrgId: "b" }),
    ).toEqual({ kind: "org", orgId: "b" });
  });

  it("with nothing remembered, the first organization", () => {
    expect(
      resolveLanding({ organizations: [B, A], rememberedPlaceId: null, rememberedOrgId: null }),
    ).toEqual({ kind: "org", orgId: "b" });
  });

  it("with no organizations, Create", () => {
    expect(
      resolveLanding({ organizations: [], rememberedPlaceId: "p-1", rememberedOrgId: "a" }),
    ).toEqual({ kind: "create" });
  });
});

describe("pickPlace", () => {
  const A = org("a", "p-1", "p-2");
  it("takes the first candidate the organization holds, then its first place", () => {
    expect(pickPlace(A, "gone", "p-2")?.id).toBe("p-2");
    expect(pickPlace(A, null, undefined)?.id).toBe("p-1");
    expect(pickPlace(org("b"), "p-1")).toBeNull();
    expect(pickPlace(null, "p-1")).toBeNull();
  });
});

describe("the root page", () => {
  const src = readFileSync(
    path.resolve(__dirname, "..", "app", "(shell)", "page.tsx"),
    "utf8",
  );
  const code = src.replace(/^\s*\/\/.*$/gm, "");

  it("answers a Stripe return on Payments before any place is considered", () => {
    expect(code.indexOf('typeof sp.connect === "string"')).toBeGreaterThan(-1);
    expect(code.indexOf('typeof sp.connect === "string"')).toBeLessThan(
      code.indexOf("resolveLanding("),
    );
    expect(code).toContain('orgHref(org.id, "payments")');
  });

  it("forwards its whole query and consumes only org", () => {
    expect(code).toContain("const { org: requestedOrg, ...rest } = sp;");
    expect(code).toContain("redirect(withQuery(target, rest))");
  });

  it("reads the two rail cookies the shell writes", () => {
    expect(code).toContain("RAIL_PLACE_COOKIE");
    expect(code).toContain("RAIL_ORG_COOKIE");
  });

  it("is a temporary redirect: nothing caches where / lands", () => {
    expect(code).not.toContain("permanentRedirect");
    expect(code).toContain("redirect(");
  });
});
