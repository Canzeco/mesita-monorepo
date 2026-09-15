import { describe, expect, it } from "vitest";
import { rowStateForLookup } from "./add-place-card";
import type { LookupPlace, LookupResult } from "./api/verifications";

const place: LookupPlace = {
  id: "p-1",
  slug: "strana",
  name: "Strana",
  state: "active",
  listing_type: "web",
  address: null,
  phone: null,
  email: null,
  website_url: null,
  photos: [],
  category: null,
  vibe: null,
  created_at: "2026-01-01",
  updated_at: null,
};

const methods = {
  phone: { available: false, displayPhone: null },
  email: { available: false, displayEmail: null },
};

describe("rowStateForLookup", () => {
  it("creates when Mesita has no row", () => {
    const lookup: LookupResult = { state: "not_in_mesita", place: null };
    const row = rowStateForLookup(lookup, new Set());
    expect(row).toEqual({ kind: "create", label: "Not on Mesita" });
  });

  // THE PRIOR LAW, KEPT: "pending verification rows are still Add (unowned
  // Mesita places)". Nobody HOLDS a place someone merely asked for, and
  // hiding the button would let an unfinished request park it forever.
  it("claims an unclaimed row, and one another org is only ASKING for", () => {
    const unclaimed: LookupResult = {
      state: "web_listed_unclaimed",
      place,
      methods,
    };
    expect(rowStateForLookup(unclaimed, new Set())).toEqual({
      kind: "claim",
      label: "On Mesita",
      place,
    });
    const pending: LookupResult = { state: "pending_by_other", place, methods };
    expect(rowStateForLookup(pending, new Set()).kind).toBe("claim");
  });

  it("opens a place the caller already holds, even if lookup says partner", () => {
    const lookup: LookupResult = {
      state: "verified_partner",
      place,
      owner: { id: "someone-else", email: "x@y.z" },
    };
    expect(rowStateForLookup(lookup, new Set(["p-1"]))).toEqual({
      kind: "open",
      label: "You hold this",
      placeId: "p-1",
    });
  });

  it("names this org's own pending claim, and still opens it", () => {
    const lookup: LookupResult = {
      state: "pending_by_me",
      place,
      methods,
      verification: {
        id: "v-1",
        method: "ai_email",
        payload: {},
        requester_email: "me@x.mx",
        state: "pending",
        reject_reason: null,
        decided_at: null,
        decided_via: null,
        created_at: "2026-01-01",
      },
    };
    expect(rowStateForLookup(lookup, new Set())).toEqual({
      kind: "pending",
      label: "Your claim is pending",
      placeId: "p-1",
    });
  });

  // Pato, MESITA-1850: a place another organization HOLDS gets no button.
  // Every action would 409, and an honest dead end beats a button that lies.
  it("states Claimed and offers nothing when another org holds it", () => {
    const lookup: LookupResult = {
      state: "verified_partner",
      place,
      owner: { id: "other", email: "owner@x.mx" },
    };
    const row = rowStateForLookup(lookup, new Set());
    expect(row).toEqual({ kind: "taken", label: "Claimed" });
    expect("place" in row).toBe(false);
    expect("placeId" in row).toBe(false);
  });
});
