import { describe, expect, it } from "vitest";
import {
  BUSINESS_ROUTES,
  dockHrefForSection,
  pathnamePlaceId,
  placePath,
  placeSwitchHref,
  promosPath,
} from "./business-route-contract";
import { resolveActivePlaceId } from "./active-place";

const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("dockHrefForSection", () => {
  it("sends Profile to the listing when a place is active", () => {
    expect(dockHrefForSection("place", A)).toBe(placePath(A, "preview"));
  });

  it("stays on the current Profile subtab when already in the listing", () => {
    expect(dockHrefForSection("place", A, `/place/${A}/place/basics`)).toBe(
      `/place/${A}/place/basics`,
    );
    expect(dockHrefForSection("place", A, `/place/${A}/promos`)).toBe(
      placePath(A, "preview"),
    );
  });

  it("keeps Profile on the hub when no place exists yet", () => {
    expect(dockHrefForSection("place", null)).toBe(BUSINESS_ROUTES.central);
  });

  it("sends Partner / Performance / Settings to /add without a place", () => {
    expect(dockHrefForSection("promos", null)).toBe(BUSINESS_ROUTES.add);
    expect(dockHrefForSection("performance", null)).toBe(BUSINESS_ROUTES.add);
    expect(dockHrefForSection("settings", null)).toBe(BUSINESS_ROUTES.add);
  });

  it("sends Partner / Performance / Settings to the place when one is active", () => {
    expect(dockHrefForSection("promos", A)).toBe(promosPath(A));
    expect(dockHrefForSection("performance", A)).toBe(`/place/${A}/performance`);
    expect(dockHrefForSection("settings", A)).toBe(`/place/${A}/settings`);
  });
});

describe("placeSwitchHref", () => {
  it("keeps the Place subtab when switching places", () => {
    expect(placeSwitchHref(B, `/place/${A}/place/basics`)).toBe(
      placePath(B, "basics"),
    );
    expect(placeSwitchHref(B, `/place/${A}/place/media`)).toBe(
      placePath(B, "media"),
    );
  });

  it("does not treat the place UUID as a Place subtab", () => {
    expect(placeSwitchHref(B, `/place/${A}/place/preview`)).toBe(
      placePath(B, "preview"),
    );
    expect(placeSwitchHref(B, `/place/${A}/place/${A}`)).toBe(
      placePath(B, "preview"),
    );
  });

  it("keeps Partner, Performance, and Settings sections", () => {
    expect(placeSwitchHref(B, `/place/${A}/promos`)).toBe(promosPath(B));
    expect(placeSwitchHref(B, `/place/${A}/performance`)).toBe(
      `/place/${B}/performance`,
    );
    expect(placeSwitchHref(B, `/place/${A}/reservations`)).toBe(
      `/place/${B}/performance`,
    );
    expect(placeSwitchHref(B, `/place/${A}/settings`)).toBe(
      `/place/${B}/settings`,
    );
  });

  it("lands retired scan/tickets on the listing", () => {
    expect(placeSwitchHref(B, `/place/${A}/scan`)).toBe(placePath(B));
    expect(placeSwitchHref(B, `/place/${A}/tickets`)).toBe(placePath(B));
  });
});

describe("pathnamePlaceId + resolveActivePlaceId", () => {
  it("reads the id from /place/{id}/…", () => {
    expect(pathnamePlaceId(`/place/${A}/place/basics`)).toBe(A);
    expect(pathnamePlaceId("/central")).toBeNull();
  });

  it("lets the URL win over the cookie", () => {
    expect(
      resolveActivePlaceId({
        pathnamePlaceId: B,
        cookieId: A,
        projectIds: [A, B],
      }),
    ).toBe(B);
  });

  it("falls back to cookie, then first place", () => {
    expect(
      resolveActivePlaceId({
        pathnamePlaceId: null,
        cookieId: B,
        projectIds: [A, B],
      }),
    ).toBe(B);
    expect(
      resolveActivePlaceId({
        pathnamePlaceId: "missing",
        cookieId: A,
        projectIds: [A, B],
      }),
    ).toBe(A);
    expect(
      resolveActivePlaceId({
        pathnamePlaceId: "missing",
        cookieId: null,
        projectIds: [A, B],
      }),
    ).toBe(A);
  });
});
