import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { NO_GOOGLE_PLACE_FACTS, isDisplayablePlacePhoto } from "../google-place-photo";
import { parsePendingPlace, pendingPlaceDetail } from "../pending-place";

// A Google-only card opens its profile at once (MESITA-2307): the tap
// stashes the card and goes to the opening screen, which draws the card as
// the profile with Google's photo and "Creating profile" in the body, awaits
// the create, then replaces the route with the real profile; the Feed
// underneath reloads.

const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

describe("the first draft of the profile", () => {
  it("is the card's facts, Google's photo, not Enriched", () => {
    const detail = pendingPlaceDetail(
      "ChIJx",
      {
        name: "Tacos Adan",
        category: "taco_restaurant",
        family_keys: ["tacos"],
        address: "Av. Garza Sada 1",
        google_rating: 4.5,
        google_count: 120,
        distance_km: 0.3,
      },
      "",
      { ...NO_GOOGLE_PLACE_FACTS, photoUrl: "https://lh3.googleusercontent.com/p" },
    );
    expect(detail.id).toBe("g:ChIJx");
    expect(detail.name).toBe("Tacos Adan");
    expect(detail.photos).toEqual(["https://lh3.googleusercontent.com/p"]);
    expect(detail.google.rating).toBe(4.5);
    expect(detail.google.count).toBe(120);
    expect(detail.distance_km).toBe(0.3);
    expect(detail.is_enriched).toBe(false);
  });

  it("falls back to the tap's name, then Google's, on a deep link with no card", () => {
    const fromTap = pendingPlaceDetail("ChIJx", null, "Doña Tota", NO_GOOGLE_PLACE_FACTS);
    expect(fromTap.name).toBe("Doña Tota");
    const fromGoogle = pendingPlaceDetail("ChIJx", null, " ", {
      name: "Señor Latino Tec",
      address: "Tec",
      photoUrl: null,
    });
    expect(fromGoogle.name).toBe("Señor Latino Tec");
    expect(fromGoogle.photos).toEqual([]);
  });

  it("reads only a stash that carries a name", () => {
    expect(parsePendingPlace(null)).toBeNull();
    expect(parsePendingPlace("{}")).toBeNull();
    expect(parsePendingPlace("not json")).toBeNull();
    expect(parsePendingPlace('{"name":"Casa"}')).toEqual({ name: "Casa" });
  });

  it("only draws a googleusercontent photo", () => {
    expect(isDisplayablePlacePhoto("https://lh3.googleusercontent.com/p")).toBe(true);
    expect(isDisplayablePlacePhoto("https://places.googleapis.com/v1/x/media")).toBe(false);
    expect(isDisplayablePlacePhoto(undefined)).toBe(false);
  });
});

describe("the open, the create and the Feed", () => {
  it("a tap stashes the card and opens the opening screen at once", () => {
    const hook = read("../use-open-google-place.ts");
    const tap = hook.slice(
      hook.indexOf("export function useOpenGooglePlace"),
      hook.indexOf("export type OpenedGooglePlace"),
    );
    expect(tap).toContain("stashPendingPlace(gid, place)");
    expect(tap).toContain("router.push(googleOpenHref(gid, place.name))");
  });

  it("the opening screen draws the profile, awaits the create, tells the Feed, then shows the real profile", () => {
    const screen = read("../../components/consumer/OpeningGooglePlace.tsx");
    const create = screen.indexOf("await getOrCreateGooglePlace(supabase, gid)");
    const emit = screen.indexOf("emitPlaceCreated({");
    const replace = screen.indexOf("router.replace(opened.href)");
    expect(create).toBeGreaterThan(0);
    expect(emit).toBeGreaterThan(create);
    expect(replace).toBeGreaterThan(emit);
    expect(screen).toContain("creating={creating}");
    // A hard-loaded page loads the real profile as a page, never as a
    // modal over itself with no Back to pop.
    expect(screen).toContain('if (variant === "page") window.location.replace(opened.href)');
    expect(screen).toContain("<PlaceDetailModalShell place={place}>");
    expect(screen).toContain("fetchGooglePlaceFacts(places, gid)");
    for (const page of [
      "../../app/(shell)/place/open/[gid]/page.tsx",
      "../../app/(shell)/@modal/(.)place/open/[gid]/page.tsx",
    ]) {
      expect(read(page), page).toContain("apiKey={process.env.NEXT_PUBLIC_GMP_KEY");
    }
  });

  it("the Feed reloads behind the modal and keeps its rails meanwhile", () => {
    const rails = read("../../components/consumer/home/CatalogRails.tsx");
    expect(rails).toContain("onPlaceCreated(() => reload.current())");
    expect(rails).toContain('fetchRails("keep")');
    expect(rails).toContain('mode === "keep") return;');
    expect(rails).toContain("apiListCatalog(supabase, coords)");
  });
});
