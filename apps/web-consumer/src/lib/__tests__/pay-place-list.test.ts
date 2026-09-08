import { describe, expect, it } from "vitest";

import type { Place, PlacePrediction } from "@/lib/api/places";
import {
  canStartPayVisit,
  keepPayable,
  payRowFromPlace,
  payRowFromPrediction,
} from "@/lib/pay-place-list";

const basePlace = {
  id: "p1",
  slug: "cosmo",
  name: "Cosmo San Pedro",
  category: "Nightclub",
  category_label: "Nightclub",
  vibe: null,
  price_level: 4,
  currency: "MXN",
  listing_type: "web",
  state: "active",
  fiscal_type: "informal",
  plan: "free",
  lat: 25.67,
  lng: -100.3,
  address: null,
  closes_at: null,
  phone: null,
  pitch: null,
  story: null,
  photos: ["https://cdn.example/cosmo.jpg"],
  website_url: null,
  instagram_url: null,
  facebook_url: null,
  whatsapp_url: null,
  opentable_url: null,
  resy_url: null,
  uber_eats_url: null,
  x_url: null,
  threads_url: null,
  reddit_url: null,
  didi_food_url: null,
  google_maps_url: null,
  email: null,
  created_at: "2026-08-01T00:00:00Z",
  zone: "Del Valle",
} as Place;

describe("canStartPayVisit", () => {
  // It was the Partner fact until 2026-09-08. Partner says the place PAYS
  // Mesita — a commercial state, not an answer to "can a guest settle a bill
  // here". Those came apart when Mesita Pay became a capability an org turns
  // on and a place opts into.
  it("is the Mesita Pay capability, never partner, listing_type or promoting", () => {
    expect(canStartPayVisit(basePlace)).toBe(false);
    expect(canStartPayVisit({ ...basePlace, mesita_pay_enabled: true })).toBe(true);
    // A paying partner that has not turned the rail on cannot take a payment.
    expect(canStartPayVisit({ ...basePlace, partner: true } as Place)).toBe(false);
    expect(
      canStartPayVisit(
        {
          ...basePlace,
          listing_type: "partner",
          partner: true,
          promoting: true,
          mesita_pay_enabled: false,
        } as Place,
      ),
    ).toBe(false);
  });

  // ABSENT MEANS NO. The wire omits the key for any row that never went
  // through the profiles view, and defaulting those to payable would offer a
  // place the checkout cannot charge.
  it("treats a missing capability as NOT payable", () => {
    expect(canStartPayVisit({} as Place)).toBe(false);
    expect(canStartPayVisit(null)).toBe(false);
    expect(canStartPayVisit(undefined)).toBe(false);
    expect(canStartPayVisit({ ...basePlace, mesita_pay_enabled: null })).toBe(false);
  });
});

describe("keepPayable", () => {
  // The filter replaced sorting-payable-first plus a toast on tap. Pato,
  // 2026-09-08: Mesita Pay enabled is the FINAL FILTER to appear there.
  it("drops every row a guest cannot pay at", () => {
    const rows = [
      payRowFromPlace({ ...basePlace, id: "a", mesita_pay_enabled: true }),
      payRowFromPlace({ ...basePlace, id: "b" }),
      payRowFromPlace({ ...basePlace, id: "c", mesita_pay_enabled: true }),
    ];
    expect(keepPayable(rows).map((r) => r.key)).toEqual(["a", "c"]);
  });

  it("preserves order — distance for nearby, relevance for a search", () => {
    const rows = ["z", "a", "m"].map((id) =>
      payRowFromPlace({ ...basePlace, id, mesita_pay_enabled: true }),
    );
    expect(keepPayable(rows).map((r) => r.key)).toEqual(["z", "a", "m"]);
  });

  it("can empty the list, and that is a real state", () => {
    // Today it IS the state: the capability is false on every place until an
    // operator turns one on, so the screen must survive having nothing.
    expect(keepPayable([payRowFromPlace(basePlace)])).toEqual([]);
  });
});

describe("payRowFromPlace", () => {
  it("locks rows without the capability and keeps enabled rows ticketable", () => {
    const locked = payRowFromPlace(basePlace);
    expect(locked.canStart).toBe(false);
    expect(locked.seed).toBeNull();
    expect(locked.subtitle).toContain("Del Valle");

    const open = payRowFromPlace({ ...basePlace, mesita_pay_enabled: true });
    expect(open.canStart).toBe(true);
    expect(open.seed?.id).toBe("p1");
  });
});

describe("payRowFromPrediction", () => {
  const google: PlacePrediction = {
    placeId: "ChIJgoogle",
    mainText: "Starbucks Manali",
    secondaryText: "Palchan",
    state: "not_in_mesita",
  };
  const mesita: PlacePrediction = {
    placeId: "ChIJcosmo",
    mainText: "Cosmo San Pedro",
    secondaryText: "Del Valle",
    state: "web_listed",
    mesitaId: "p1",
  };

  it("locks Google-only name hits", () => {
    const row = payRowFromPrediction(google, [basePlace]);
    expect(row.canStart).toBe(false);
    expect(row.seed).toBeNull();
    expect(row.subtitle).toBe("Palchan");
  });

  it("uses the nearby place when the name hit is already in the 50", () => {
    // Delegating to the real row is what gives a search hit its photo AND its
    // capability — a prediction carries neither.
    const enabled = { ...basePlace, mesita_pay_enabled: true };
    const row = payRowFromPrediction(mesita, [enabled]);
    expect(row.canStart).toBe(true);
    expect(row.photo).toBe("https://cdn.example/cosmo.jpg");
    expect(row.seed?.id).toBe("p1");
  });

  // DELIBERATE REVERSAL (2026-09-08). An off-list Mesita hit used to be
  // ticketable off a `{id, name}` seed alone. It cannot be any more: a
  // prediction carries no capability fact, and the only safe default is NOT
  // payable — offering a place the checkout cannot charge is the worse
  // failure. The real fix is consumer-web-suggest-places shipping the fact,
  // not the client guessing; until then the miss is narrow, because nearby is
  // the closest 50 and the guest is standing in the place.
  it("refuses an off-list Mesita name hit — no capability fact means no", () => {
    const row = payRowFromPrediction(mesita, []);
    expect(row.canStart).toBe(false);
    expect(row.seed).toBeNull();
  });
});
