import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Keeps the "use server" actions.ts and its supabase-ef import out of the
// graph; never called (a static render runs no handlers).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/(app)/manage-multiple/actions", () => ({
  autocompleteGooglePlaces: vi.fn(),
  createPlaceFromGooglePlaceId: vi.fn(),
  listAllPlaces: vi.fn(),
  searchMesitaNames: vi.fn(),
  searchPlacesByGoogleIds: vi.fn(),
}));

import { AbsentCard, SinglePlaceClient } from "./SinglePlaceClient";

const GID = "ChIJN1t_tDeuEmsRUsoyG83frY4";

describe("Single Place", () => {
  it("renders Find before the catalogue arrives — a hit opens the place, it is not drawn here", () => {
    const html = renderToStaticMarkup(<SinglePlaceClient />);
    expect(html).toContain("The list is every place Mesita holds.");
    expect(html).toContain("Press Enter to search.");
    expect(html).toContain("Loading Mesita places");
    expect(html).toContain(">Find<");
    expect(html).not.toContain("Finding");
    const field = html.slice(
      html.indexOf('id="single-place-lookup"'),
      html.indexOf("/>", html.indexOf('id="single-place-lookup"')),
    );
    expect(field).not.toMatch(/\sdisabled(?:[\s=]|$)/);
    expect(html).toContain("ChIJ… or a place name");
    expect(html).not.toContain("Overwrite existing data");
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
