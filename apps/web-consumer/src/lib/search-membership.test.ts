import { describe, expect, it } from "vitest";

import {
  buildSearchMapPins,
  membershipColor,
  membershipTone,
  pinFillColor,
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
    expect(
      membershipTone({ status: "not_in_mesita", partner: true }),
    ).toBe("google");
    expect(placeMembershipTone({ partner: true })).toBe("partner");
    expect(placeMembershipTone({ partner: false })).toBe("listed");
    expect(placeMembershipTone({ plan: "pro" })).toBe("partner");
  });

  it("uses Mesita pink, a true gray, and a map-readable yellow", () => {
    expect(membershipColor("partner")).toBe("#fb2b7b");
    expect(membershipColor("listed")).toBe("#9ca3af");
    expect(membershipColor("google")).toBe("#EAB308");
  });

  it("fills the selected pin black and leaves unselected membership colors", () => {
    expect(pinFillColor("partner", false)).toBe("#fb2b7b");
    expect(pinFillColor("listed", false)).toBe("#9ca3af");
    expect(pinFillColor("google", false)).toBe("#EAB308");
    expect(pinFillColor("partner", true)).toBe("#111111");
    expect(pinFillColor("listed", true)).toBe("#111111");
    expect(pinFillColor("google", true)).toBe("#111111");
  });

  it("opens then on a later tap of the same pin, not a timed dblclick", () => {
    expect(pinGesture(null, "a")).toBe("select");
    expect(pinGesture("b", "a")).toBe("select");
    expect(pinGesture("a", "a")).toBe("open");
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
