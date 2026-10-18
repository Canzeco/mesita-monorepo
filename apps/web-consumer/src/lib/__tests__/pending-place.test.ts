import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { NO_GOOGLE_PLACE_FACTS, isDisplayablePlacePhoto } from "../google-place-photo";
import { parsePendingPlace, pendingPlaceDetail } from "../pending-place";
import {
  pendingPlaceGid,
  pendingPlaceHref,
  toCanonicalPlaceHrefOrNull,
} from "../place-route";

// A Google-only card opens its profile at once (MESITA-2307): the route
// carries the Google Place ID, the screen draws the card as the profile
// with Google's photo, awaits the create, then replaces the URL with the
// real profile; the Feed underneath reloads.

const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

describe("the pending place route", () => {
  it("wears the catalog stub's own prefix and round-trips the id", () => {
    expect(pendingPlaceHref("ChIJx")).toBe("/place/g:ChIJx");
    expect(pendingPlaceGid("g:ChIJx")).toBe("ChIJx");
    expect(pendingPlaceGid("casa")).toBeNull();
    expect(pendingPlaceGid("g:")).toBeNull();
    expect(toCanonicalPlaceHrefOrNull("g:ChIJx")).toBe("/place/g:ChIJx");
  });

  it("both place pages branch on it before any row fetch", () => {
    for (const page of [
      "../../app/(shell)/place/[id]/page.tsx",
      "../../app/(shell)/@modal/(.)place/[id]/page.tsx",
    ]) {
      const src = read(page);
      const branch = src.indexOf("pendingPlaceGid(id)");
      const fetch = src.indexOf("apiFetchPlaceDetail(supabase, id)");
      expect(branch, page).toBeGreaterThan(0);
      expect(fetch, page).toBeGreaterThan(branch);
      expect(src).toContain("<PendingPlaceScreen");
    }
  });
});

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

  it("falls back to Google's name and address on a deep link with no card", () => {
    const detail = pendingPlaceDetail("ChIJx", null, {
      name: "Señor Latino Tec",
      address: "Tec",
      photoUrl: null,
    });
    expect(detail.name).toBe("Señor Latino Tec");
    expect(detail.photos).toEqual([]);
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
  it("a tap opens the pending route at once and creates nothing itself", () => {
    const hook = read("../use-open-google-place.ts");
    expect(hook).toContain("stashPendingPlace(gid, place)");
    expect(hook).toContain("router.push(pendingPlaceHref(gid))");
    expect(hook).not.toContain("apiCreateProject");
  });

  it("the screen awaits the create, tells the Feed, then shows the real profile", () => {
    const screen = read("../../components/consumer/PendingPlaceScreen.tsx");
    const create = screen.indexOf("await apiCreateProject(supabase, { placeId: gid })");
    const emit = screen.indexOf("emitPlaceCreated({");
    const replace = screen.indexOf("router.replace(placeHref(dest))");
    expect(create).toBeGreaterThan(0);
    expect(emit).toBeGreaterThan(create);
    expect(replace).toBeGreaterThan(emit);
    expect(screen).toContain("creating={creating}");
    expect(screen).toContain("<PlaceDetailModalShell place={place}>");
  });

  it("the Feed reloads behind the modal and keeps its rails meanwhile", () => {
    const rails = read("../../components/consumer/home/CatalogRails.tsx");
    expect(rails).toContain("onPlaceCreated(() => reload.current())");
    expect(rails).toContain('fetchRails("keep")');
    expect(rails).toContain('mode === "keep") return;');
    expect(rails).toContain("apiListCatalog(supabase, coords)");
  });
});
