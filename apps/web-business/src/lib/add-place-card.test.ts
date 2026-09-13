import { describe, expect, it } from "vitest";
import { cardForLookup } from "./add-place-card";
import type { LookupPlace, LookupResult } from "./api/verifications";
import type { PlacePrediction } from "./api/place-search";

const prediction: PlacePrediction = {
  placeId: "ChIJtest",
  mainText: "Strana",
  secondaryText: "Valle",
  state: "not_in_mesita",
};

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

describe("cardForLookup", () => {
  it("mints when Mesita has no row", () => {
    const lookup: LookupResult = { state: "not_in_mesita", place: null };
    expect(cardForLookup(lookup, prediction, new Set()).kind).toBe("create");
  });

  it("adds unclaimed and pending rows", () => {
    const unclaimed: LookupResult = {
      state: "web_listed_unclaimed",
      place,
      methods,
    };
    expect(cardForLookup(unclaimed, prediction, new Set()).kind).toBe("add");
    const pending: LookupResult = {
      state: "pending_by_other",
      place,
      methods,
    };
    expect(cardForLookup(pending, prediction, new Set()).kind).toBe("add");
  });

  it("opens a place this org already holds, even if lookup says partner", () => {
    const lookup: LookupResult = {
      state: "verified_partner",
      place,
      owner: { id: "someone-else", email: "x@y.z" },
    };
    const card = cardForLookup(lookup, prediction, new Set(["p-1"]));
    expect(card).toEqual({ kind: "open", placeId: "p-1", name: "Strana" });
  });

  it("shows partner-other when another org holds it", () => {
    const lookup: LookupResult = {
      state: "verified_partner",
      place,
      owner: { id: "other", email: "owner@x.mx" },
    };
    const card = cardForLookup(lookup, prediction, new Set());
    expect(card.kind).toBe("partner");
  });
});
