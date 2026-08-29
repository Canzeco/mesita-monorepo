import { describe, expect, it } from "vitest";

import {
  MAP_GOOGLE_PIN_COLOR,
  MAP_ENRICHED_PIN_COLOR,
  MAP_PARTNER_PIN_COLOR,
  MAP_PIN_HIT_SIZE,
  MAP_PIN_SCALE,
  MAP_PIN_STROKE_COLOR,
  MAP_PIN_STROKE_WEIGHT,
  MAP_PLACE_PIN_RADIUS,
  MAP_USER_LOCATION_PIN_COLOR,
  mapCircleIcon,
  mapPinIcon,
  mapPinSvg,
} from "@/lib/map-defaults";
import {
  buildSearchMapPins,
  catalogPlaceOnMesita,
  isEnrichedPlace,
  membershipColor,
  membershipTone,
  overlayPinDecision,
  pinFillColor,
  pinStrokeColor,
  pinGesture,
  placeMembershipTone,
  predictionOnMesita,
} from "@/lib/search-membership";

describe("search membership tones — partner > enriched > everything else", () => {
  // THE LAW (Pato, 2026-08-29): yellow beats red beats gray, and red is
  // EARNED by enrichment. A row existing is not enough.
  it("paints map rows in that order", () => {
    const ready = { content_status: "ready" };
    expect(placeMembershipTone({ partner: true, ...ready })).toBe("partner");
    // Partner beats enriched: an unenriched partner is still yellow.
    expect(placeMembershipTone({ partner: true })).toBe("partner");
    expect(placeMembershipTone({ partner: false, ...ready })).toBe("enriched");
    // THE FIX: a Created / Requested stub used to paint red.
    expect(placeMembershipTone({ partner: false })).toBe("unlisted");
    expect(placeMembershipTone({ partner: false, request_count: 3 } as never)).toBe(
      "unlisted",
    );
    expect(placeMembershipTone({ googleOnly: true })).toBe("unlisted");
    expect(placeMembershipTone({ from_google: true })).toBe("unlisted");
    // A Google stub stays gray even if it somehow carries enrichment.
    expect(placeMembershipTone({ googleOnly: true, ...ready })).toBe("unlisted");
  });

  it("paints name-lane rows the same way, gray when the server is silent", () => {
    expect(
      membershipTone({ status: "web_listed", partner: true, enriched: false }),
    ).toBe("partner");
    expect(
      membershipTone({ status: "web_listed", partner: false, enriched: true }),
    ).toBe("enriched");
    // THE FIX: a Google hit resolving onto a Created stub used to be red.
    expect(
      membershipTone({ status: "web_listed", partner: false, enriched: false }),
    ).toBe("unlisted");
    // Older payload with no `enriched` at all: understate, never overclaim.
    expect(membershipTone({ status: "web_listed", partner: false })).toBe(
      "unlisted",
    );
    expect(membershipTone({ status: "not_in_mesita", partner: true })).toBe(
      "unlisted",
    );
  });

  it("counts ready OR a stamped enriched_at, never one alone", () => {
    // 27% of the live catalog is ready with a null enriched_at
    // (measured 2026-08-29). An enriched_at-only test would grey a
    // quarter of the catalog on deploy.
    expect(isEnrichedPlace({ content_status: "ready" })).toBe(true);
    expect(isEnrichedPlace({ enriched_at: "2026-08-01T00:00:00Z" })).toBe(true);
    expect(isEnrichedPlace({ content_status: "queued" })).toBe(false);
    expect(isEnrichedPlace({})).toBe(false);
    // The server's boolean wins over the columns, both ways.
    expect(isEnrichedPlace({ enriched: true })).toBe(true);
    expect(isEnrichedPlace({ enriched: false, content_status: "ready" })).toBe(
      false,
    );
  });

  it("uses yellow Partners, red enriched Mesita, gray everything else", () => {
    expect(membershipColor("partner")).toBe(MAP_PARTNER_PIN_COLOR);
    expect(membershipColor("enriched")).toBe(MAP_ENRICHED_PIN_COLOR);
    expect(membershipColor("unlisted")).toBe(MAP_GOOGLE_PIN_COLOR);
    expect(MAP_PARTNER_PIN_COLOR).toBe("#ffc400");
    expect(MAP_ENRICHED_PIN_COLOR).toBe("#ff2357");
    expect(MAP_GOOGLE_PIN_COLOR).toBe("#9ca3af");
    expect(MAP_PARTNER_PIN_COLOR).not.toBe(MAP_ENRICHED_PIN_COLOR);
  });

  it("keeps membership fill and rings the selected pin black", () => {
    expect(pinFillColor("partner", false)).toBe(MAP_PARTNER_PIN_COLOR);
    expect(pinFillColor("enriched", false)).toBe(MAP_ENRICHED_PIN_COLOR);
    expect(pinFillColor("unlisted", false)).toBe(MAP_GOOGLE_PIN_COLOR);
    expect(pinFillColor("partner", true)).toBe(MAP_PARTNER_PIN_COLOR);
    expect(pinFillColor("enriched", true)).toBe(MAP_ENRICHED_PIN_COLOR);
    expect(pinFillColor("unlisted", true)).toBe(MAP_GOOGLE_PIN_COLOR);
    expect(pinStrokeColor(false)).toBe("#ffffff");
    expect(pinStrokeColor(true)).toBe("#111111");
  });

  it("opens then on a later tap of the same pin, not a timed dblclick", () => {
    expect(pinGesture(null, "a")).toBe("select");
    expect(pinGesture("b", "a")).toBe("select");
    expect(pinGesture("a", "a")).toBe("open");
  });
});

describe("membershipTone", () => {
  it("treats mesitaId as on-Mesita even when status is not_in_mesita", () => {
    // mesitaId still wins over a stale status — but being on Mesita is no
    // longer enough for red. Enrichment is what earns it.
    expect(
      membershipTone({
        status: "not_in_mesita",
        mesitaId: "uuid-1",
        enriched: true,
      }),
    ).toBe("enriched");
    expect(
      membershipTone({
        status: "not_in_mesita",
        mesitaId: "uuid-1",
        enriched: false,
      }),
    ).toBe("unlisted");
  });
});

describe("predictionOnMesita", () => {
  it("uses mesitaId/slug over a stale not_in_mesita status", () => {
    expect(
      predictionOnMesita({ status: "not_in_mesita", mesitaId: "x" }),
    ).toBe(true);
    expect(
      predictionOnMesita({ status: "not_in_mesita", mesitaSlug: "slug" }),
    ).toBe(true);
    expect(predictionOnMesita({ status: "not_in_mesita" })).toBe(false);
    expect(predictionOnMesita({ status: "web_listed" })).toBe(true);
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
  it("paints the pin from the prediction, not a catalog plan fallback", () => {
    const pins = buildSearchMapPins(
      [
        {
          placeId: "ChIJ1",
          mainText: "Strana",
          status: "web_listed",
          partner: true,
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
        tone: "partner",
      },
    ]);
  });

  it("returns null when predictions have no coords (keep catalog markers)", () => {
    expect(
      buildSearchMapPins(
        [
          {
            placeId: "ChIJ1",
            mainText: "Nowhere",
            status: "not_in_mesita",
            partner: false,
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

describe("mapCircleIcon", () => {
  it("draws red place pins and the blue user pin the same size", () => {
    const red = mapCircleIcon(MAP_ENRICHED_PIN_COLOR, MAP_PIN_STROKE_COLOR);
    const blue = mapCircleIcon(
      MAP_USER_LOCATION_PIN_COLOR,
      MAP_PIN_STROKE_COLOR,
    );
    const selected = mapCircleIcon(MAP_ENRICHED_PIN_COLOR, "#111111");
    expect(red.path).toBe(blue.path);
    expect(red.scale).toBe(blue.scale);
    expect(red.strokeWeight).toBe(blue.strokeWeight);
    expect(selected.path).toBe(blue.path);
    expect(selected.scale).toBe(MAP_PIN_SCALE);
    expect(selected.strokeWeight).toBe(MAP_PIN_STROKE_WEIGHT);
    expect(red.fillColor).not.toBe(blue.fillColor);
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
