import { describe, expect, it } from "vitest";

import type { Place } from "@/lib/api/places";
import { placeSearchScope } from "@/lib/map-filters-engine";
import {
  MAP_GOOGLE_PIN_COLOR,
  MAP_PREMIER_PIN_COLOR,
  MAP_PIN_HIT_SIZE,
  MAP_PIN_STROKE_COLOR,
  MAP_PLACE_PIN_RADIUS,
  MAP_SELECTED_PIN_COLOR,
  mapPinIcon,
  mapPinSvg,
} from "@/lib/map-defaults";
import {
  buildSearchMapPins,
  catalogPlaceOnMesita,
  overlayPinDecision,
  pinFillColor,
  pinGesture,
  pinStrokeColor,
  pinStrokeWeight,
  pinToneColor,
  placePinTone,
  predictionOnMesita,
  predictionPinTone,
} from "./search-pins";

describe("pin tones — premier > mesita > google", () => {
  // THE LAW (Pato, 2026-10-12, MESITA-2158; MESITA-2925): the three nested
  // sets — Google ⊃ Mesita ⊃ Mesita Premier. Red is Premier (a paid
  // tier), gray is everything else.
  it("paints map rows red only when the place is Premier (MESITA-2925)", () => {
    const marked = { boost_tier: 1 };
    expect(placePinTone(marked)).toBe("premier");
    // Enrichment paints nothing: an Enriched place that is not Premier is
    // gray, and a Created place that is Premier is red.
    const enrichedUnmarked = {
      enriched: true,
      enriched_at: "2026-08-01T00:00:00Z",
      boost_tier: 0,
    };
    expect(placePinTone(enrichedUnmarked)).toBe("mesita");
    const createdMarked: Partial<Place> = {
      content_state: "ready",
      enriched_at: null,
      boost_tier: 1,
    };
    expect(placePinTone(createdMarked)).toBe("premier");
    const created: Partial<Place> = {
      content_state: "ready",
      enriched_at: null,
    };
    expect(placePinTone(created)).toBe("mesita");
    expect(placePinTone({ ...created, boost_tier: 0 })).toBe("mesita");
    // An older payload without the mark understates, never overclaims.
    expect(placePinTone({})).toBe("mesita");
    const requested: Partial<Place> = {
      content_state: "generating",
      request_count: 3,
      enriched_at: null,
    };
    expect(placePinTone(requested)).toBe("mesita");
    expect(placePinTone({ googleOnly: true })).toBe("google");
    expect(placePinTone({ from_google: true })).toBe("google");
    // A Google stub stays gray even if it somehow carries the mark.
    expect(placePinTone({ googleOnly: true, ...marked })).toBe("google");
  });

  it("agrees with the scope the Filters sheet counts the place in (MESITA-2298)", () => {
    // Gray-as-google is Google's alone; red and gray Mesita rows are both
    // Mesita's scope.
    const rows = [
      { id: "e", slug: "e", name: "E", category: null, boost_tier: 1 },
      { id: "c", slug: "c", name: "C", category: null, content_state: "ready" },
      { id: "g:x", slug: "x", name: "X", category: null, googleOnly: true },
    ] as Place[];
    for (const row of rows) {
      expect(placePinTone(row) === "google").toBe(
        placeSearchScope(row) === "google",
      );
    }
  });

  it("paints name-lane rows the same way, gray when the server is silent", () => {
    expect(predictionPinTone({ state: "web_listed", boost_tier: 1 })).toBe(
      "premier",
    );
    expect(predictionPinTone({ state: "web_listed", boost_tier: 0 })).toBe(
      "mesita",
    );
    // Older payload with no `boost_tier` at all: understate, never overclaim.
    expect(predictionPinTone({ state: "web_listed" })).toBe("mesita");
    expect(predictionPinTone({ state: "not_in_mesita", boost_tier: 1 })).toBe(
      "google",
    );
  });

  it("treats mesitaId as on-Mesita even when state is not_in_mesita", () => {
    // mesitaId still wins over a stale state — but being on Mesita is not
    // enough for red. Premier is what earns it.
    expect(
      predictionPinTone({
        state: "not_in_mesita",
        mesitaId: "uuid-1",
        boost_tier: 1,
      }),
    ).toBe("premier");
    expect(
      predictionPinTone({
        state: "not_in_mesita",
        mesitaId: "uuid-1",
        boost_tier: 0,
      }),
    ).toBe("mesita");
  });

  it("uses red for Mesita Premier and gray for everything else (MESITA-2316)", () => {
    expect(pinToneColor("premier")).toBe(MAP_PREMIER_PIN_COLOR);
    // A Mesita place that is not Premier is gray like a Google row.
    expect(pinToneColor("mesita")).toBe(MAP_GOOGLE_PIN_COLOR);
    expect(pinToneColor("google")).toBe(MAP_GOOGLE_PIN_COLOR);
    expect(MAP_PREMIER_PIN_COLOR).toBe("#ff2357");
    expect(MAP_GOOGLE_PIN_COLOR).toBe("#a3a3a3");
    expect(MAP_PREMIER_PIN_COLOR).not.toBe(MAP_GOOGLE_PIN_COLOR);
  });

  it("rings every place pin dark; a held pin CHANGES colour (MESITA-2488)", () => {
    expect(pinFillColor("premier")).toBe(MAP_PREMIER_PIN_COLOR);
    expect(pinFillColor("mesita")).toBe(MAP_GOOGLE_PIN_COLOR);
    expect(pinFillColor("google")).toBe(MAP_GOOGLE_PIN_COLOR);
    // Held (tapped): ink fill, white ring, whatever the tone was.
    expect(pinFillColor("premier", true)).toBe(MAP_SELECTED_PIN_COLOR);
    expect(pinFillColor("google", true)).toBe(MAP_SELECTED_PIN_COLOR);
    expect(MAP_SELECTED_PIN_COLOR).not.toBe(MAP_PREMIER_PIN_COLOR);
    expect(MAP_SELECTED_PIN_COLOR).not.toBe(MAP_GOOGLE_PIN_COLOR);
    expect(pinStrokeColor(false)).toBe("#111111");
    expect(pinStrokeColor(true)).toBe("#ffffff");
    expect(pinStrokeWeight(true)).toBeGreaterThan(pinStrokeWeight(false));
    expect(
      mapPinSvg(
        MAP_GOOGLE_PIN_COLOR,
        pinStrokeColor(true),
        pinStrokeWeight(true),
      ),
    ).toContain(`stroke-width="${pinStrokeWeight(true)}"`);
  });

  it("select, then fly, then open — counted taps, not a timed dblclick", () => {
    const away = { arrivedId: null, atSight: false };
    expect(pinGesture(null, "a", away)).toBe("select");
    expect(pinGesture("b", "a", away)).toBe("select");
    expect(pinGesture("a", "a", away)).toBe("fly");
    expect(pinGesture("a", "a", { arrivedId: "a", atSight: false })).toBe(
      "open",
    );
    // A fly to another pin does not count for this one.
    expect(pinGesture("a", "a", { arrivedId: "b", atSight: false })).toBe(
      "fly",
    );
    // Already under the sight: the fly would not move, so it opens.
    expect(pinGesture("a", "a", { arrivedId: null, atSight: true })).toBe(
      "open",
    );
    // Not selected yet: select, even under the sight.
    expect(pinGesture(null, "a", { arrivedId: "a", atSight: true })).toBe(
      "select",
    );
  });
});

describe("predictionOnMesita", () => {
  it("uses mesitaId/slug over a stale not_in_mesita state", () => {
    expect(predictionOnMesita({ state: "not_in_mesita", mesitaId: "x" })).toBe(
      true,
    );
    expect(
      predictionOnMesita({ state: "not_in_mesita", mesitaSlug: "slug" }),
    ).toBe(true);
    expect(predictionOnMesita({ state: "not_in_mesita" })).toBe(false);
    expect(predictionOnMesita({ state: "web_listed" })).toBe(true);
  });
});

describe("catalogPlaceOnMesita", () => {
  it("treats added Google stubs with real ids as on-Mesita", () => {
    expect(catalogPlaceOnMesita({ id: "uuid", from_google: true })).toBe(true);
    expect(catalogPlaceOnMesita({ id: "g:ChIJ", googleOnly: true })).toBe(
      false,
    );
  });
});

describe("overlayPinDecision", () => {
  const mesitaOverlay = {
    googleOnly: false,
    inCatalog: false,
    hasOverlay: true,
    arrivedId: null,
    atSight: false,
  };
  const googleOverlay = {
    googleOnly: true,
    inCatalog: false,
    hasOverlay: true,
    arrivedId: null,
    atSight: false,
  };

  it("flies to a selected pin on its second tap, before it opens", () => {
    expect(
      overlayPinDecision({ selectedId: "g1", pinId: "g1", ...googleOverlay }),
    ).toBe("fly");
    expect(
      overlayPinDecision({
        selectedId: "m-off",
        pinId: "m-off",
        ...mesitaOverlay,
      }),
    ).toBe("fly");
  });

  it("selects an overlay Mesita pin that is not in the catalog", () => {
    expect(
      overlayPinDecision({
        selectedId: null,
        pinId: "m-off",
        ...mesitaOverlay,
      }),
    ).toBe("select-mesita-overlay");
  });

  it("opens the Mesita slug on a later tap of the same overlay-only pin", () => {
    expect(
      overlayPinDecision({
        selectedId: "m-off",
        pinId: "m-off",
        ...mesitaOverlay,
        arrivedId: "m-off",
      }),
    ).toBe("open-mesita-slug");
  });

  it("selects B when A is held and B is overlay-only Mesita — never opens", () => {
    expect(
      overlayPinDecision({
        selectedId: "a",
        pinId: "b",
        ...mesitaOverlay,
      }),
    ).toBe("select-mesita-overlay");
  });

  it("stashes Google on first tap and opens the sheet on a later tap", () => {
    expect(
      overlayPinDecision({
        selectedId: null,
        pinId: "g1",
        ...googleOverlay,
      }),
    ).toBe("select-google");
    expect(
      overlayPinDecision({
        selectedId: "g1",
        pinId: "g1",
        ...googleOverlay,
        arrivedId: "g1",
      }),
    ).toBe("open-google");
  });

  it("switching Google → overlay Mesita selects and does not open", () => {
    expect(
      overlayPinDecision({
        selectedId: "g1",
        pinId: "m-off",
        ...mesitaOverlay,
      }),
    ).toBe("select-mesita-overlay");
  });

  it("re-tapping Google after holding Mesita selects Google, does not open", () => {
    expect(
      overlayPinDecision({
        selectedId: "m-off",
        pinId: "g1",
        ...googleOverlay,
      }),
    ).toBe("select-google");
  });

  it("opens a catalog row on its third tap, once the camera flew there", () => {
    expect(
      overlayPinDecision({
        selectedId: "c1",
        pinId: "c1",
        googleOnly: false,
        inCatalog: true,
        hasOverlay: false,
        arrivedId: "c1",
        atSight: false,
      }),
    ).toBe("open-catalog");
  });

  it("does not invent a /place open when the Google stash is empty", () => {
    expect(
      overlayPinDecision({
        selectedId: "g1",
        pinId: "g1",
        googleOnly: false,
        inCatalog: false,
        hasOverlay: false,
        arrivedId: "g1",
        atSight: false,
      }),
    ).toBe("noop");
    expect(
      overlayPinDecision({
        selectedId: "g1",
        pinId: "g1",
        googleOnly: false,
        inCatalog: false,
        hasOverlay: false,
        arrivedId: null,
        atSight: false,
      }),
    ).toBe("noop");
  });
});

describe("buildSearchMapPins", () => {
  it("paints the pin from the prediction's own Premier tier", () => {
    const pins = buildSearchMapPins(
      [
        {
          placeId: "ChIJ1",
          mainText: "Strana",
          state: "web_listed",
          boost_tier: 1,
          mesitaId: "m1",
          lat: 25.6,
          lng: -100.4,
        },
      ],
      [{ id: "m1", lat: 25.6, lng: -100.4 }],
    );
    expect(pins).toEqual([
      {
        id: "m1",
        lat: 25.6,
        lng: -100.4,
        title: "Strana",
        tone: "premier",
      },
    ]);
  });

  it("borrows coordinates from the catalog row when the wire has none", () => {
    const pins = buildSearchMapPins(
      [
        {
          placeId: "ChIJ1",
          mainText: "Strana",
          state: "web_listed",
          mesitaId: "m1",
        },
      ],
      [{ id: "m1", lat: 25.6, lng: -100.4 }],
    );
    expect(pins?.[0]).toMatchObject({ id: "m1", lat: 25.6, lng: -100.4 });
  });

  it("returns null when predictions have no coords (keep catalog markers)", () => {
    expect(
      buildSearchMapPins(
        [
          {
            placeId: "ChIJ1",
            mainText: "Nowhere",
            state: "not_in_mesita",
          },
        ],
        [],
      ),
    ).toBeNull();
  });

  it("returns null when the query produced no predictions", () => {
    expect(buildSearchMapPins([], [{ id: "m1", lat: 1, lng: 2 }])).toBeNull();
  });
});

describe("mapPinIcon", () => {
  it("paints a bigger disk inside a 44px tap pad", () => {
    expect(MAP_PLACE_PIN_RADIUS).toBe(7);
    expect(MAP_PIN_HIT_SIZE).toBe(44);
    const svg = mapPinSvg(MAP_PREMIER_PIN_COLOR, MAP_PIN_STROKE_COLOR);
    expect(svg).toContain(`r="${MAP_PLACE_PIN_RADIUS}"`);
    expect(svg).toContain(`width="${MAP_PIN_HIT_SIZE}"`);
    expect(svg).toContain('fill-opacity="0.01"');
    const icon = mapPinIcon(MAP_PREMIER_PIN_COLOR, MAP_PIN_STROKE_COLOR);
    expect(icon.scaledSize).toEqual({
      width: MAP_PIN_HIT_SIZE,
      height: MAP_PIN_HIT_SIZE,
    });
    expect(icon.anchor).toEqual({
      x: MAP_PIN_HIT_SIZE / 2,
      y: MAP_PIN_HIT_SIZE / 2,
    });
    expect(icon.url).toContain("data:image/svg+xml");
  });
});
