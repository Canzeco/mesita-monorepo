import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CRENUP_STEPS } from "@/lib/state-vocabulary";
import type { PlaceHit } from "@/app/(app)/manage-multiple/actions";

// Keeps the "use server" actions.ts and its supabase-ef import out of the
// graph; never called (a static render runs no handlers).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/(app)/manage-multiple/actions", () => ({
  createPlaceFromGooglePlaceId: vi.fn(),
  deletePlace: vi.fn(),
  enrichPlace: vi.fn(),
  listAllPlaces: vi.fn(),
  searchPlacesByGoogleIds: vi.fn(),
  setPlaceListed: vi.fn(),
}));

import { AbsentCard, SinglePlaceClient } from "./SinglePlaceClient";

const GID = "ChIJN1t_tDeuEmsRUsoyG83frY4";

export const FIXTURE_HIT: PlaceHit = {
  id: "0f3a5d2c-9b1e-4c7a-8d2f-5e6a7b8c9d01",
  slug: "cafe-nin",
  name: "Café Nin",
  google_name: "Cafe Nin",
  category: "cafe",
  category_label: "Café",
  family_keys: null,
  state: "active",
  address: "Calle Havre 73, Juárez, Ciudad de México",
  photo: null,
  zone: "Juárez",
  google_stars_overall: 4.6,
  google_review_count: 2431,
  content_state: "ready",
  listing_type: null,
  google_place_id: GID,
  seeded: true,
  listed: true,
  requested: false,
  request_count: 0,
  enriching: false,
  business_state: "OPERATIONAL",
  business_state_at: "2026-10-09T18:00:00.000Z",
  enrich_crenup: 5,
  enrich_crenup_total: 8,
  enrich_crenup_labels: CRENUP_STEPS.map((s) => s.label),
  enrich_crenup_blocked: { key: "reviews", index: 5, state: "failed" },
  enrich_functions: null,
  partner: false,
  promoting: false,
  promoting_level: 0,
  mesita_pay: false,
  credits: false,
  pickup: false,
  delivery: false,
  promotion: 2,
};

describe("Single Place", () => {
  it("opens on the Find box alone — a hit opens the place, it is not drawn here", () => {
    const html = renderToStaticMarkup(<SinglePlaceClient />);
    expect(html).toContain("ChIJ… or a place name");
    expect(html).not.toContain("General States");
    expect(html).not.toContain(">Create<");
  });

  it("says Not on Mesita for an unknown Google Place ID, with what Google knows", () => {
    const html = renderToStaticMarkup(
      <AbsentCard
        view={{
          kind: "absent",
          googleId: GID,
          google: {
            id: GID,
            displayName: "Taquería Orinoco",
            formattedAddress: "Av. Insurgentes Sur 1, Roma",
            lat: null,
            lng: null,
            rating: 4.4,
            userRatingCount: 918,
            existsInMesita: false,
            createdAt: null,
            updatedAt: null,
          },
          note: null,
        }}
      />,
    );
    expect(html).toContain("Taquería Orinoco");
    expect(html).toContain("4.4 · 918 reviews");
    expect(html).toContain("Create");
  });
});
