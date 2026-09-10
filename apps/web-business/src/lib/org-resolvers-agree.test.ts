// The console answers "which organization?" twice: once on the server, per
// page (`resolveActiveOrg`), and once on the client, for the chrome that wraps
// every page (`resolveChromeOrg`). Both files' docblocks claim the second
// MIRRORS the first. Until this file, nothing proved it: `shell-contract.test.ts`
// imports only the server rule and `use-active-org.test.ts` imports only the
// client one, so the four "mirrors the server's rule" assertions over there are
// hand-retyped constants that go on passing after the server rule changes.
//
// A drift is silent and expensive: the rail lists org A's places down the left
// edge while the page body renders org B's money. There is no error, no log,
// and every existing test stays green.
//
// So: one differential, both rules, the whole input cross-product.
//
// THE SHAPES DIFFER AND THAT IS THE POINT. The server reads Next's
// `searchParams`, which types a repeated `?org=` as `string[]`; the client
// reads `useSearchParams().get("org")`, which returns `string | null` and hands
// back the FIRST value. `asChrome` below is that mapping written down — if it
// ever stops being the truth, this file is where it gets caught.
import { describe, expect, it } from "vitest";
import { resolveActiveOrg } from "./active-organization";
import { resolveChromeOrg } from "./use-active-org";
import type { Organization } from "./api/organizations";

const org = (id: string): Organization => ({
  id,
  name: id.toUpperCase(),
  legalName: null,
  rfc: null,
  currency: "MXN",
  myRole: "owner",
  placeCount: 0,
});

/** What `useSearchParams().get("org")` returns for a given `searchParams` value. */
function asChrome(requested: string | string[] | undefined): string | null {
  if (Array.isArray(requested)) return requested[0] ?? null;
  return requested ?? null;
}

const ORG_SETS: { label: string; orgs: Organization[] }[] = [
  { label: "no organizations", orgs: [] },
  { label: "one organization", orgs: [org("a")] },
  { label: "two organizations", orgs: [org("a"), org("b")] },
];

const REQUESTED: { label: string; value: string | string[] | undefined }[] = [
  { label: "absent", value: undefined },
  { label: "empty string", value: "" },
  { label: "the first org", value: "a" },
  { label: "the second org", value: "b" },
  { label: "a foreign id", value: "someone-elses-org" },
  // Next types a repeated `?org=a&org=b` as an array; the client only ever
  // sees the first. Both must land on the same org.
  { label: "repeated params", value: ["b", "a"] },
];

describe("the server and chrome org resolvers agree", () => {
  for (const { label: orgLabel, orgs } of ORG_SETS) {
    for (const { label: reqLabel, value } of REQUESTED) {
      it(`${orgLabel}, ?org= ${reqLabel}`, () => {
        const server = resolveActiveOrg(orgs, value)?.id ?? null;
        const chrome = resolveChromeOrg(orgs, asChrome(value))?.id ?? null;
        expect(chrome).toBe(server);
      });
    }
  }
});

describe("the rule they agree ON", () => {
  const orgs = [org("a"), org("b")];

  // These pin the BEHAVIOUR, so the differential above cannot pass by both
  // resolvers breaking the same way.
  it("honours a membership the caller actually has", () => {
    expect(resolveActiveOrg(orgs, "b")?.id).toBe("b");
    expect(resolveChromeOrg(orgs, "b")?.id).toBe("b");
  });

  it("falls back to the first org rather than erroring", () => {
    // Deliberate, and load-bearing: an id you are not a member of must resolve
    // exactly like an id that does not exist, or the parameter becomes a
    // membership oracle for anyone who can edit the query string.
    // See active-organization.ts and use-active-org.ts.
    for (const stale of ["someone-elses-org", ""]) {
      expect(resolveActiveOrg(orgs, stale)?.id).toBe("a");
      expect(resolveChromeOrg(orgs, stale)?.id).toBe("a");
    }
  });

  it("is null only when the caller belongs to none", () => {
    expect(resolveActiveOrg([], "a")).toBeNull();
    expect(resolveChromeOrg([], "a")).toBeNull();
  });
});
