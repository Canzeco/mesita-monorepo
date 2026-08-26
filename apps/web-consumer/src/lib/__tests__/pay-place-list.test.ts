import { describe, expect, it } from "vitest";

import type { Place, PlacePrediction } from "@/lib/api/places";
import {
  canStartPayVisit,
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
  status: "active",
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
  it("is promoting, never listing_type", () => {
    expect(canStartPayVisit(basePlace)).toBe(false);
    expect(canStartPayVisit({ ...basePlace, promoting: true })).toBe(true);
    expect(
      canStartPayVisit({ ...basePlace, listing_type: "partner", promoting: false } as Place),
    ).toBe(false);
  });
});

describe("payRowFromPlace", () => {
  it("locks non-promoting rows as Soon and keeps promoting rows ticketable", () => {
    const locked = payRowFromPlace(basePlace);
    expect(locked.canStart).toBe(false);
    expect(locked.seed).toBeNull();
    expect(locked.subtitle).toContain("Del Valle");

    const open = payRowFromPlace({ ...basePlace, promoting: true });
    expect(open.canStart).toBe(true);
    expect(open.seed?.id).toBe("p1");
  });
});

describe("payRowFromPrediction", () => {
  const google: PlacePrediction = {
    placeId: "ChIJgoogle",
    mainText: "Starbucks Manali",
    secondaryText: "Palchan",
    status: "not_in_mesita",
  };
  const mesita: PlacePrediction = {
    placeId: "ChIJcosmo",
    mainText: "Cosmo San Pedro",
    secondaryText: "Del Valle",
    status: "web_listed",
    mesitaId: "p1",
  };

  it("locks Google-only name hits", () => {
    const row = payRowFromPrediction(google, [basePlace]);
    expect(row.canStart).toBe(false);
    expect(row.seed).toBeNull();
    expect(row.subtitle).toBe("Palchan");
  });

  it("uses the nearby place when the name hit is already in the 50", () => {
    const promoting = { ...basePlace, promoting: true };
    const row = payRowFromPrediction(mesita, [promoting]);
    expect(row.canStart).toBe(true);
    expect(row.photo).toBe("https://cdn.example/cosmo.jpg");
    expect(row.seed?.id).toBe("p1");
  });

  it("keeps an off-list Mesita name hit ticketable", () => {
    const row = payRowFromPrediction(mesita, []);
    expect(row.canStart).toBe(true);
    expect(row.seed).toEqual({ id: "p1", name: "Cosmo San Pedro" });
  });
});
