import { describe, expect, it } from "vitest";

import {
  MAP_LISTED_PIN_COLOR,
  MAP_PIN_SCALE,
  MAP_PIN_STROKE_COLOR,
  MAP_PIN_STROKE_WEIGHT,
  MAP_USER_LOCATION_PIN_COLOR,
  mapCircleIcon,
} from "@/lib/map-defaults";
import {
  buildSearchMapPins,
  membershipColor,
  membershipTone,
  overlayPinDecision,
  pinFillColor,
  pinStrokeColor,
  pinGesture,
  placeMembershipTone,
} from "@/lib/search-membership";

describe("search membership tones", () => {
  it("maps partner / listed / google-only", () => {
    expect(membershipTone({ status: "web_listed", partner: true })).toBe(
      "partner",
    );
    expect(membershipTone({ status: "web_listed", partner: false })).toBe(
      "listed",
    );
    expect(membershipTone({ status: "not_in_mesita", partner: true })).toBe(
      "google",
    );
    expect(placeMembershipTone({ partner: true })).toBe("partner");
    expect(placeMembershipTone({ partner: false })).toBe("listed");
    expect(placeMembershipTone({ plan: "pro" })).toBe("partner");
    expect(placeMembershipTone({ googleOnly: true })).toBe("google");
    expect(placeMembershipTone({ from_google: true })).toBe("google");
  });

  it("uses gray for Google-only and red for every Mesita place", () => {
    expect(membershipColor("partner")).toBe("#ff2357");
    expect(membershipColor("listed")).toBe("#ff2357");
    expect(membershipColor("google")).toBe("#9ca3af");
  });

  it("keeps membership fill and rings the selected pin black", () => {
    expect(pinFillColor("partner", false)).toBe("#ff2357");
    expect(pinFillColor("listed", false)).toBe("#ff2357");
    expect(pinFillColor("google", false)).toBe("#9ca3af");
    expect(pinFillColor("partner", true)).toBe("#ff2357");
    expect(pinFillColor("listed", true)).toBe("#ff2357");
    expect(pinFillColor("google", true)).toBe("#9ca3af");
    expect(pinStrokeColor(false)).toBe("#ffffff");
    expect(pinStrokeColor(true)).toBe("#111111");
  });

  it("opens then on a later tap of the same pin, not a timed dblclick", () => {
    expect(pinGesture(null, "a")).toBe("select");
    expect(pinGesture("b", "a")).toBe("select");
    expect(pinGesture("a", "a")).toBe("open");
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
    const red = mapCircleIcon(MAP_LISTED_PIN_COLOR, MAP_PIN_STROKE_COLOR);
    const blue = mapCircleIcon(
      MAP_USER_LOCATION_PIN_COLOR,
      MAP_PIN_STROKE_COLOR,
    );
    const selected = mapCircleIcon(MAP_LISTED_PIN_COLOR, "#111111");
    expect(red.path).toBe(blue.path);
    expect(red.scale).toBe(blue.scale);
    expect(red.strokeWeight).toBe(blue.strokeWeight);
    expect(selected.path).toBe(blue.path);
    expect(selected.scale).toBe(MAP_PIN_SCALE);
    expect(selected.strokeWeight).toBe(MAP_PIN_STROKE_WEIGHT);
    expect(red.fillColor).not.toBe(blue.fillColor);
  });
});
