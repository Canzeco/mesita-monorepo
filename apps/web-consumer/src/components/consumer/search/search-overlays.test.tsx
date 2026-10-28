// MVP test rule (MESITA-2600): only the EF contract guard stays; UI pins were removed (MESITA-2601).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SearchResultsPanel } from "@/components/consumer/search/SearchResultsPanel";
import {
  ANCHOR_DROP_KM,
  anchorPlaceFromPrediction,
  anchorSurvivesReload,
  catalogIsStale,
  prependAnchorPlace,
} from "@/components/consumer/search/search-utils";
import type { Place } from "@/lib/api/places";
import type { PlacePrediction } from "@/lib/api/place-search";

const SEARCH_DIR = join(__dirname);

function read(name: string): string {
  return readFileSync(join(SEARCH_DIR, name), "utf8");
}

describe("Search map catalog reloads once the map is still (MESITA-2440)", () => {
  it("loads the operator's How many, not an SSR 200 dump", () => {
    expect(read("SearchClient.tsx")).toContain("apiFetchNearbyCatalog");
    // How many, the source and the Google reviews minimum are the
    // operator's (MESITA-2384, MESITA-2417); the guest posts the family.
    expect(read("SearchClient.tsx")).not.toContain("resultLimit");
    expect(read("SearchClient.tsx")).not.toContain("placesScope");
    expect(read("SearchClient.tsx")).toContain("familyKeys");
    expect(read("SearchClient.tsx")).not.toContain("minReviews");
    expect(read("SearchClient.tsx")).toContain("onFirstViewport");
    expect(read("SearchClient.tsx")).toContain("reloadWaitMs");
    expect(read("SearchClient.tsx")).not.toContain("idleReloadDue");
    expect(read("SearchClient.tsx")).toContain("armIdleReload");
    expect(read("SearchClient.tsx")).not.toContain("handleSearchHere");
    expect(read("SearchClient.tsx")).not.toContain("SearchHereButton");
    expect(read("SearchClient.tsx")).not.toContain("VIEWPORT_IDLE_MS");
    expect(read("SearchMap.tsx")).toContain("ViewportReporter");
    expect(read("SearchMap.tsx")).toContain("SearchMapReticle");
    expect(read("SearchMap.tsx")).toContain("noteProgrammaticCamera");
    expect(read("SearchMap.tsx")).toContain("noteUserMapDrag");
    expect(read("SearchMap.tsx")).toContain('addListener("dragstart"');
    expect(read("SearchMap.tsx")).not.toContain("PROGRAMMATIC_IDLE_MS");
    // The "Finding / Updating nearby" line left with the readout (MESITA-2670);
    // a reload dims the floating cards instead.
    expect(read("search-catalog-overlays.tsx")).toContain("opacity-55");
    expect(read("search-catalog-overlays.tsx")).not.toContain("Search here");
    expect(read("SearchClient.tsx")).toContain("++viewportGen.current");
    expect(read("SearchClient.tsx")).not.toContain("toFixed(3)");
    // `google: true` survives and is NOT the ring: it says this client can
    // render a Google-only stub; the EF refuses a call without it
    // (MESITA-2337).
    expect(read("../../../lib/api/places.ts")).toContain("google: true");
    expect(read("../../../lib/api/places.ts")).toContain("reloadIdleSec");
    expect(read("../../../lib/api/places.ts")).toContain("reloadMinViewportPct");
  });

  it("arms one timer per guest move, timed from the last reload; any camera move cancels it", () => {
    const src = read("SearchClient.tsx");
    // MESITA-2451: the gap counts from the last reload, not the last move.
    expect(src).toMatch(
      /reloadWaitMs\(\s*lastLoadAtRef\.current,\s*Date\.now\(\),\s*reloadIdleMsRef\.current,?\s*\)/,
    );
    expect(src).toContain("lastLoadAtRef.current = Date.now();");
    expect(src).toContain("clampReloadIdleSec(result.reloadIdleSec)");
    expect(src).toContain("clampReloadMinViewportPct(");
    expect(src).toContain("reloadMoveMeetsMin(");
    expect(src).toContain("lastReloadBoxRef.current");
    expect(src).toContain("markViewport(box)");
    expect(src).toMatch(
      /if \(meta\.programmatic\) \{[\s\S]*return;[\s\S]*armIdleReload\(\)/,
    );
    expect(src).toContain("onCameraMoveStart={clearPendingReload}");
    const map = read("SearchMap.tsx");
    expect(map).toContain('addListener("bounds_changed"');
    // The old distance-AND-time gate is gone, not left half-wired.
    expect(src).not.toContain("reloadMinSec");
    expect(src).not.toContain("forceNextLoad");
  });

  it("never reloads under a finger: the timer re-arms while one is down", () => {
    const src = read("SearchClient.tsx");
    expect(src).toMatch(
      /if \(mapFingerIsDown\(\)\) \{\s*pendingReload\.current = setTimeout\(fire/,
    );
    const map = read("SearchMap.tsx");
    expect(map).toContain('div.addEventListener("pointerdown", down, true)');
    expect(map).toContain('window.addEventListener("pointerup", up, true)');
  });

  it("a pan the page made never reloads; only the guest's own moves do", () => {
    const src = read("SearchClient.tsx");
    expect(src).toMatch(
      /if \(meta\.programmatic\) \{[\s\S]*clearPendingReload\(\);\s*return;/,
    );
    expect(src).toContain("Only the guest's own moves");
  });

  it("spends the programmatic flag on the idle that ends the move", () => {
    const src = read("SearchMap.tsx");
    expect(src).toContain("cameraMoveIsProgrammatic");
    expect(src).toContain("function takeProgrammaticIdle");
    expect(src).toContain("const programmatic = takeProgrammaticIdle();");
    expect(src).toContain(
      "onUser?.(box, { programmatic, resized: !programmatic && unmoved });",
    );
    expect(src).toMatch(
      /addListener\("dragstart", \(\) => \{\s*noteUserMapDrag\(\);/,
    );
    expect(src).not.toContain("PROGRAMMATIC_IDLE_MS");
    expect(src).not.toContain("programmaticIdleUntil");
  });

  // MESITA-2510 (Pato: "you are uplaoading every second eve if i don't
  // move"): a resize keeps the camera, so its idle is not a move — it never
  // reloads, and it re-arms a guest move the resize's bounds_changed cancelled.
  it("a resize idle (camera unchanged) never reloads, and re-arms an unserved move", () => {
    const map = read("SearchMap.tsx");
    const client = read("SearchClient.tsx");
    expect(map).toContain(
      "const unmoved = sameCamera(lastCamera.current, camera);",
    );
    const handler = client.slice(
      client.indexOf("const onUserViewport = useCallback("),
      client.indexOf("useEffect(() => () => clearPendingReload()"),
    );
    const resized = handler.slice(
      handler.indexOf("if (meta.resized) {"),
      handler.indexOf("if (meta.programmatic) {"),
    );
    expect(resized).toContain("if (moveUnservedRef.current) armIdleReload();");
    expect(resized).toContain("return;");
    expect(resized).not.toContain("loadAt(");
    expect(handler).toContain("moveUnservedRef.current = true;");
    expect(client).toMatch(
      /lastLoadAtRef\.current = Date\.now\(\);\s*lastReloadBoxRef\.current = box;\s*moveUnservedRef\.current = false;/,
    );
  });

  it("a GPS fix moves the dot; only the first or an asked-for fix moves the map", () => {
    const src = read("SearchClient.tsx");
    expect(src).toContain("useOnUserFix(");
    expect(src).toContain("gpsFixMovesCamera({");
    expect(src).toContain("catalogIsStale(lastFetchedCenter.current, fix)");
    // Nothing keys the camera on the location object any more.
    expect(src).not.toContain("viewCenter=");
    expect(read("SearchMap.tsx")).not.toContain("function Recentre");
  });
});

const RAIL_PLACE = {
  id: "p1",
  slug: "cosmo",
  name: "Cosmo San Pedro",
  category: "Nightclub",
  price_level: 4,
  currency: "MXN",
  lat: 25.67,
  lng: -100.3,
  address: null,
  closes_at: null,
  phone: null,
  pitch: null,
  story: null,
  photos: [],
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
  created_at: "2026-08-01T00:00:00Z",
} as Place;

describe("Name search is ONE search after Word's idle seconds (MESITA-2322)", () => {
  it("calls suggest-places once, Google's names only, after the EF's idle wait", () => {
    const src = read("SearchClient.tsx");
    expect(src).toContain("DEFAULT_IDLE_MS");
    expect(src).toContain("idleMsRef.current");
    // MESITA-2896: Google's names only — `deep` (Autocomplete + Text
    // Search); the Mesita Name mode is gone.
    expect(src).toContain('"deep"');
    expect(src).not.toContain('"mesita"');
    expect(src).not.toContain('"fast"');
    expect(src).not.toContain("FAST_DEBOUNCE_MS");
    expect(src).not.toContain("DEEP_IDLE_MS");
  });

  it("takes the idle seconds from every answer", () => {
    const src = read("SearchClient.tsx");
    expect(src).toMatch(
      /if \(idleSec !== null\) idleMsRef\.current = Math\.round\(idleSec \* 1000\)/,
    );
  });
});

describe("catalogIsStale", () => {
  const last = { lat: 25.5, lng: -100.3 };

  it("is false before the first fetch and for a 110 m nudge", () => {
    expect(catalogIsStale(null, last)).toBe(false);
    expect(catalogIsStale(last, { lat: 25.501, lng: -100.3 })).toBe(false);
  });

  it("is true after a couple of city blocks", () => {
    expect(catalogIsStale(last, { lat: 25.503, lng: -100.3 })).toBe(true);
  });
});

describe("a Google-only result opens through get-or-create, never a preview or a photo (MESITA-2298)", () => {
  it("has no preview sheet, no client-side Places call, and one create call site", () => {
    const client = read("SearchClient.tsx");
    expect(client).toContain("openGoogleOnly");
    expect(client).toContain("openGoogleProfile");
    expect(client).not.toContain("GooglePlaceSheet");
    expect(client).not.toContain("fetchGooglePlacePreview");
    expect(client).not.toContain("setPreviewOpen");
    expect(client).not.toContain("places.googleapis.com");
    // The explicit open goes to the opening screen at once (MESITA-2311);
    // Search itself never creates. The ONE place that creates is the opening
    // screen's getOrCreateGooglePlace, reached only from that screen.
    expect(client).not.toContain("apiCreateProject(");
    const open = client.slice(
      client.indexOf("const openGoogleProfile"),
      client.indexOf("const openGoogleOnly"),
    );
    // The card rides along: the opening screen draws it as the profile's
    // first draft (MESITA-2307).
    expect(open).toContain("openGooglePlace(");
    const opener = readFileSync(
      join(SEARCH_DIR, "../../../lib/use-open-google-place.ts"),
      "utf8",
    );
    expect(opener.match(/apiCreateProject\(/g)?.length).toBe(1);
    // ONE TAP OPENS a rail card (MESITA-2824), and still never creates: the
    // tap goes to the opening screen, which is where get-or-create runs
    // (MESITA-2305 holds). No select-first branch stands between the tap
    // and the open any more.
    const openPlace = client.slice(
      client.indexOf("const handleOpenPlace"),
      client.indexOf("const railSelectedId"),
    );
    expect(openPlace).toContain("openGoogleOnly(google, place)");
    expect(openPlace).not.toContain("handleSelectPlace(place)");
    expect(openPlace).not.toContain("getOrCreateGooglePlace");
    const railCard = read("SearchRailCard.tsx");
    expect(railCard).toContain("onClick={onOpen}");
    expect(railCard).not.toContain("onSelect");
    for (const gone of ["GooglePlaceSheet.tsx"]) {
      expect(existsSync(join(SEARCH_DIR, gone)), gone).toBe(false);
    }
    expect(
      existsSync(join(SEARCH_DIR, "../../../lib/google-place-preview.ts")),
    ).toBe(false);
    expect(read("SearchRailCard.tsx")).not.toContain("places.googleapis.com");
  });
});

describe("every searchbar pick anchors the map (MESITA-1405)", () => {
  it("a searchbar pick never creates a place", () => {
    // Data guard: openGoogleOnly/openGoogleProfile end in get-or-create, so a
    // pick routed through them would create a place on a mere selection.
    const client = read("SearchClient.tsx");
    const barPick = client.slice(
      client.indexOf("const handleBarPick"),
      client.indexOf("const handleOpenPlace"),
    );
    expect(barPick).not.toContain("openGoogleOnly");
    expect(barPick).not.toContain("openGoogleProfile");
  });

  it("resolves a Location on pick, once (MESITA-1405, back in MESITA-2896)", () => {
    const client = read("SearchClient.tsx");
    expect(client).toContain("apiResolveLocationAnchor");
    // The camera side: a bounds anchor FITS (city wide, neighbourhood
    // close); a place anchor pans.
    const map = read("SearchMap.tsx");
    expect(map).toContain("function CameraDirector");
    expect(map).toContain("map.fitBounds(step.bounds)");
    expect(map).toMatch(
      /CameraDirector[\s\S]{0,800}noteProgrammaticCamera\(\)/,
    );
  });

  it("prepends the pick after the operator's cap — it never vetoes the pick", () => {
    const client = read("SearchClient.tsx");
    const memo = client.slice(
      client.indexOf("const catalog = useMemo"),
      client.indexOf("}, [nearby, anchor, distanceCenter]);"),
    );
    // The cap is the EF's now (MESITA-1699), so the memo has one job: put the
    // picked place first. It must still not re-cut what the server sent.
    expect(memo).toContain("prependAnchorPlace(nearby, anchorRow)");
    expect(memo).not.toContain("takeMapResultLimit");
    // A thin operator ring still cannot hide the place the guest typed.
    expect(memo.indexOf("anchorRow")).toBeLessThan(
      memo.indexOf("prependAnchorPlace"),
    );
  });
});

describe("a Location wears the location icon, never a place tone (MESITA-1404)", () => {
  it("speaks a Created place as a basic profile, never as not-enriched (MESITA-2154, MESITA-2298)", () => {
    const html = renderToStaticMarkup(
      <SearchResultsPanel
        query="strana"
        searching={false}
        searchError={null}
        predictions={[
          {
            placeId: "ChIJ-created",
            mainText: "Strana",
            secondaryText: "Monterrey",
            state: "web_listed",
            enriched: false,
            mesitaId: "m-created",
          },
          {
            // Enriched, yet not Official: the row speaks the basic profile.
            // Official is a paid tier, never enrichment (MESITA-2925).
            placeId: "ChIJ-enriched",
            mainText: "Casa",
            secondaryText: "Monterrey",
            state: "web_listed",
            enriched: true,
            mesitaId: "m-enriched",
          },
          {
            placeId: "ChIJ-official",
            mainText: "Nectarworks",
            secondaryText: "Monterrey",
            state: "web_listed",
            enriched: false,
            boost_tier: 1,
            mesitaId: "m-official",
          },
        ]}
        onPick={() => {}}
        onAction={() => {}}
      />,
    );
    expect(html).toContain("Strana, Monterrey, Basic Mesita profile");
    expect(html).toContain("Casa, Monterrey, Basic Mesita profile");
    expect(html).toContain("Nectarworks, Monterrey, Official 2X");
    expect(html).not.toContain("No profile yet");
    expect(html).not.toMatch(/enriched/i);
  });
});

describe("anchor helpers", () => {
  const GOOGLE_PICK: PlacePrediction = {
    placeId: "ChIJx",
    mainText: "Taquería Nueva",
    secondaryText: "Calle Falsa 123",
    state: "not_in_mesita",
    lat: 25.66,
    lng: -100.31,
  };

  it("anchorPlaceFromPrediction mirrors the Google-stub shape", () => {
    const stub = anchorPlaceFromPrediction(GOOGLE_PICK)!;
    expect(stub.id).toBe("g:ChIJx");
    expect(stub.slug).toBe("ChIJx");
    expect(stub.google_place_id).toBe("ChIJx");
    expect(stub.googleOnly).toBe(true);
    expect(stub.from_google).toBe(true);
    expect(stub.name).toBe("Taquería Nueva");
    expect(stub.photos).toEqual([]);
  });

  it("a Google-only Text Search pick's draft carries its card (MESITA-2325)", () => {
    const stub = anchorPlaceFromPrediction({
      ...GOOGLE_PICK,
      card: {
        id: "g:other",
        category: "taco_restaurant",
        category_label: "Taco restaurant",
        price_level: 1,
        google_stars_overall: 4.7,
        google_review_count: 320,
        open_now: true,
        phone: "+52 81 1234 5678",
        google_maps_url: "https://maps.google.com/?cid=9",
        lat: 0,
        lng: 0,
      },
    })!;
    expect(stub.id).toBe("g:ChIJx");
    expect(stub.lat).toBe(GOOGLE_PICK.lat);
    expect(stub.category_label).toBe("Taco restaurant");
    expect(stub.price_level).toBe(1);
    expect(stub.google_review_count).toBe(320);
    expect(stub.open_now).toBe(true);
    expect(stub.phone).toBe("+52 81 1234 5678");
    expect(stub.google_maps_url).toBe("https://maps.google.com/?cid=9");
  });

  it("a Mesita pick never draws an http photo (next/image would crash the page)", () => {
    const row = anchorPlaceFromPrediction({
      ...GOOGLE_PICK,
      state: "web_listed",
      mesitaId: "m-1",
      card: {
        photos: ["http://legacy.example/a.jpg", "https://cdn.example/b.jpg"],
      },
    })!;
    expect(row.photos).toEqual(["https://cdn.example/b.jpg"]);
  });

  it("anchorPlaceFromPrediction keeps Mesita identity for stamped rows", () => {
    const row = anchorPlaceFromPrediction({
      ...GOOGLE_PICK,
      state: "web_listed",
      mesitaId: "m-1",
      mesitaSlug: "taqueria-nueva",
      enriched: true,
    })!;
    expect(row.id).toBe("m-1");
    expect(row.slug).toBe("taqueria-nueva");
    expect(row.enriched).toBe(true);
    expect(row.googleOnly).toBeUndefined();
  });

  it("anchorPlaceFromPrediction refuses a row without coordinates", () => {
    expect(
      anchorPlaceFromPrediction({ ...GOOGLE_PICK, lat: null, lng: null }),
    ).toBe(null);
    expect(
      anchorPlaceFromPrediction({
        ...GOOGLE_PICK,
        lat: undefined,
        lng: undefined,
      }),
    ).toBe(null);
  });

  it("prependAnchorPlace: inside the N stays N unique, outside becomes N + 1", () => {
    const a = { ...RAIL_PLACE, id: "a" } as Place;
    const b = { ...RAIL_PLACE, id: "b" } as Place;
    const outside = { ...RAIL_PLACE, id: "c" } as Place;
    // Outside the capped set: 21 is correct, not a bug.
    expect(prependAnchorPlace([a, b], outside).map((p) => p.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
    // Inside it: the catalog's own richer row wins the front slot.
    const richer = {
      ...RAIL_PLACE,
      id: "b",
      photos: ["https://x/p.jpg"],
    } as Place;
    const woven = prependAnchorPlace([a, richer], b);
    expect(woven.map((p) => p.id)).toEqual(["b", "a"]);
    expect(woven[0].photos).toEqual(["https://x/p.jpg"]);
    expect(prependAnchorPlace([a, b], null)).toEqual([a, b]);
  });

  it("prependAnchorPlace joins a stub to the catalog row on the Google spine", () => {
    const stub = anchorPlaceFromPrediction(GOOGLE_PICK)!;
    const catalogStub = {
      ...RAIL_PLACE,
      id: "g:ChIJx",
      slug: "ChIJx",
      googleOnly: true,
      from_google: true,
    } as Place;
    const woven = prependAnchorPlace(
      [{ ...RAIL_PLACE, id: "a" } as Place, catalogStub],
      stub,
    );
    expect(woven.map((p) => p.id)).toEqual(["g:ChIJx", "a"]);
  });

  it("anchorSurvivesReload keeps its own load and drops real travel", () => {
    const at = { lat: 25.66, lng: -100.31 };
    expect(anchorSurvivesReload(at, { lat: 25.66, lng: -100.31 })).toBe(true);
    // Under the 0.5 km drag-reload floor, so a pick's own load never clears.
    expect(ANCHOR_DROP_KM).toBeLessThan(0.5);
    expect(anchorSurvivesReload(at, { lat: 25.7, lng: -100.31 })).toBe(false);
    expect(anchorSurvivesReload({ lat: null, lng: null }, at)).toBe(false);
  });

});
