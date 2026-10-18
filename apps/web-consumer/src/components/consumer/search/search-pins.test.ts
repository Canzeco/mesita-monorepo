import { describe, expect, it } from "vitest";

import type { Place } from "@/lib/api/places";
import { placeSearchScope } from "@/lib/map-filters-engine";
import {
  MAP_GOOGLE_PIN_COLOR,
  MAP_ENRICHED_PIN_COLOR,
  MAP_PIN_HIT_SIZE,
  MAP_PIN_STROKE_COLOR,
  MAP_PLACE_PIN_RADIUS,
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
  pinToneColor,
  placePinTone,
  predictionOnMesita,
  predictionPinTone,
} from "./search-pins";

describe("pin tones — enriched > mesita > google", () => {
  // THE LAW (Pato, 2026-10-12, MESITA-2158): the three nested sets the
  // Filters sheet lists — Google ⊃ Mesita ⊃ Mesita Enriched. Red is EARNED by
  // enrichment, ink is ours-not-enriched, gray is Google's alone: a set the
  // guest can pick has to be the same set the colour promises.
  it("paints map rows red only once an Enrich run completed", () => {
    const stamped = { enriched_at: "2026-08-01T00:00:00Z" };
    expect(placePinTone(stamped)).toBe("enriched");
    expect(placePinTone({ enriched: true })).toBe("enriched");
    // MESITA-2154: a Created place (ready, no stamp) is NOT red — `ready`
    // means the profile can be shown, not that it was enriched. It is ours,
    // so it wears ink, never Google's gray (MESITA-2158).
    const created = { content_state: "ready", enriched_at: null };
    expect(placePinTone(created)).toBe("mesita");
    expect(placePinTone({ ...created, enriched: false })).toBe("mesita");
    expect(placePinTone({})).toBe("mesita");
    const requested = {
      content_state: "generating",
      request_count: 3,
      enriched_at: null,
    };
    expect(placePinTone(requested)).toBe("mesita");
    expect(placePinTone({ googleOnly: true })).toBe("google");
    expect(placePinTone({ from_google: true })).toBe("google");
    // A Google stub stays gray even if it somehow carries enrichment.
    expect(placePinTone({ googleOnly: true, ...stamped })).toBe("google");
  });

  it("agrees with the scope the Filters sheet counts the place in (MESITA-2298)", () => {
    // Gray is Google's alone, and only Google's; red and ink are both Mesita
    // Selected on the sheet — the tone keeps the colour's promise, the scope
    // the guest's two words.
    const rows = [
      { id: "e", slug: "e", name: "E", category: null, enriched: true },
      { id: "c", slug: "c", name: "C", category: null, content_state: "ready" },
      { id: "g:x", slug: "x", name: "X", category: null, googleOnly: true },
    ] as Place[];
    for (const row of rows) {
      expect(placePinTone(row) === "google").toBe(
        placeSearchScope(row) === "google",
      );
    }
  });

  it("paints name-lane rows the same way, ink when the server is silent", () => {
    expect(
      predictionPinTone({ state: "web_listed", enriched: true }),
    ).toBe("enriched");
    // A Google hit resolving onto a Created stub used to be red.
    expect(
      predictionPinTone({ state: "web_listed", enriched: false }),
    ).toBe("mesita");
    // Older payload with no `enriched` at all: understate, never overclaim.
    expect(predictionPinTone({ state: "web_listed" })).toBe("mesita");
    expect(
      predictionPinTone({ state: "not_in_mesita", enriched: true }),
    ).toBe("google");
  });

  it("treats mesitaId as on-Mesita even when state is not_in_mesita", () => {
    // mesitaId still wins over a stale state — but being on Mesita is not
    // enough for red. Enrichment is what earns it.
    expect(
      predictionPinTone({
        state: "not_in_mesita",
        mesitaId: "uuid-1",
        enriched: true,
      }),
    ).toBe("enriched");
    expect(
      predictionPinTone({
        state: "not_in_mesita",
        mesitaId: "uuid-1",
        enriched: false,
      }),
    ).toBe("mesita");
  });

  it("uses red for Mesita Selected and gray for everything else (MESITA-2316)", () => {
    expect(pinToneColor("enriched")).toBe(MAP_ENRICHED_PIN_COLOR);
    // A Created profile is gray like a Google row until it is enriched.
    expect(pinToneColor("mesita")).toBe(MAP_GOOGLE_PIN_COLOR);
    expect(pinToneColor("google")).toBe(MAP_GOOGLE_PIN_COLOR);
    expect(MAP_ENRICHED_PIN_COLOR).toBe("#ff2357");
    expect(MAP_GOOGLE_PIN_COLOR).toBe("#9ca3af");
    expect(MAP_ENRICHED_PIN_COLOR).not.toBe(MAP_GOOGLE_PIN_COLOR);
  });

  it("keeps the tone fill and rings the selected pin black", () => {
    expect(pinFillColor("enriched")).toBe(MAP_ENRICHED_PIN_COLOR);
    expect(pinFillColor("mesita")).toBe(MAP_GOOGLE_PIN_COLOR);
    expect(pinFillColor("google")).toBe(MAP_GOOGLE_PIN_COLOR);
    expect(pinStrokeColor(false)).toBe("#ffffff");
    expect(pinStrokeColor(true)).toBe("#111111");
  });

  it("opens on a later tap of the same pin, not a timed dblclick", () => {
    expect(pinGesture(null, "a")).toBe("select");
    expect(pinGesture("b", "a")).toBe("select");
    expect(pinGesture("a", "a")).toBe("open");
  });
});

describe("predictionOnMesita", () => {
  it("uses mesitaId/slug over a stale not_in_mesita state", () => {
    expect(
      predictionOnMesita({ state: "not_in_mesita", mesitaId: "x" }),
    ).toBe(true);
    expect(
      predictionOnMesita({ state: "not_in_mesita", mesitaSlug: "slug" }),
    ).toBe(true);
    expect(predictionOnMesita({ state: "not_in_mesita" })).toBe(false);
    expect(predictionOnMesita({ state: "web_listed" })).toBe(true);
  });
});

describe("catalogPlaceOnMesita", () => {
  it("treats added Google stubs with real ids as on-Mesita", () => {
    expect(
      catalogPlaceOnMesita({ id: "uuid", from_google: true }),
    ).toBe(true);
    expect(
      catalogPlaceOnMesita({ id: "g:ChIJ", googleOnly: true }),
    ).toBe(false);
  });
});

describe("overlayPinDecision", () => {
  const mesitaOverlay = {
    googleOnly: false,
    inCatalog: false,
    hasOverlay: true,
  };
  const googleOverlay = {
    googleOnly: true,
    inCatalog: false,
    hasOverlay: true,
  };

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

  it("opens a catalog row on its second tap", () => {
    expect(
      overlayPinDecision({
        selectedId: "c1",
        pinId: "c1",
        googleOnly: false,
        inCatalog: true,
        hasOverlay: false,
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
      }),
    ).toBe("noop");
  });
});

describe("buildSearchMapPins", () => {
  it("paints the pin from the prediction's own enriched flag", () => {
    const pins = buildSearchMapPins(
      [
        {
          placeId: "ChIJ1",
          mainText: "Strana",
          state: "web_listed",
          enriched: true,
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
        tone: "enriched",
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
    expect(MAP_PLACE_PIN_RADIUS).toBe(10);
    expect(MAP_PIN_HIT_SIZE).toBe(44);
    const svg = mapPinSvg(MAP_ENRICHED_PIN_COLOR, MAP_PIN_STROKE_COLOR);
    expect(svg).toContain(`r="${MAP_PLACE_PIN_RADIUS}"`);
    expect(svg).toContain(`width="${MAP_PIN_HIT_SIZE}"`);
    expect(svg).toContain('fill-opacity="0.01"');
    const icon = mapPinIcon(MAP_ENRICHED_PIN_COLOR, MAP_PIN_STROKE_COLOR);
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
