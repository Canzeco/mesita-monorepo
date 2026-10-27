// The one navigation guard (MESITA-2824): a push that commits is left
// alone; a push that never moves the address becomes a page load at the
// surface URL. Guards a dead tap, which on Search was the whole screen.
// Node environment: `window` is a stub with the two things navigate.ts
// reads, the address and the timer.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NAV_FALLBACK_MS, navigateTo } from "../navigate";

type Loc = { pathname: string; assign: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn> };

function stubWindow(pathname: string): Loc {
  const location: Loc = { pathname, assign: vi.fn(), replace: vi.fn() };
  vi.stubGlobal("window", { location, setTimeout: globalThis.setTimeout });
  return location;
}

describe("navigateTo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("pushes the surface URL and does nothing more once the address moves", () => {
    const loc = stubWindow("/mob/search");
    const router = { push: vi.fn(), replace: vi.fn() };
    navigateTo(router, "/place/casa");
    expect(router.push).toHaveBeenCalledWith("/mob/place/casa");
    loc.pathname = "/mob/place/casa";
    vi.advanceTimersByTime(NAV_FALLBACK_MS + 1);
    expect(loc.assign).not.toHaveBeenCalled();
    expect(loc.replace).not.toHaveBeenCalled();
  });

  it("loads the page when the push never commits", () => {
    const loc = stubWindow("/web/search");
    const router = { push: vi.fn(), replace: vi.fn() };
    navigateTo(router, "/home/places");
    vi.advanceTimersByTime(NAV_FALLBACK_MS - 1);
    expect(loc.assign).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(loc.assign).toHaveBeenCalledWith("/web/home/places");
    expect(console.warn).toHaveBeenCalled();
  });

  it("a replace that never commits loads with location.replace, keeping Back", () => {
    const loc = stubWindow("/mob/place/open/abc");
    const router = { push: vi.fn(), replace: vi.fn() };
    navigateTo(router, "/place/casa", { replace: true });
    expect(router.replace).toHaveBeenCalledWith("/mob/place/casa");
    expect(router.push).not.toHaveBeenCalled();
    vi.advanceTimersByTime(NAV_FALLBACK_MS + 1);
    expect(loc.replace).toHaveBeenCalledWith("/mob/place/casa");
    expect(loc.assign).not.toHaveBeenCalled();
  });

  it("an already-prefixed href is pushed as is", () => {
    stubWindow("/mob/search");
    const router = { push: vi.fn(), replace: vi.fn() };
    navigateTo(router, "/mob/home/places");
    expect(router.push).toHaveBeenCalledWith("/mob/home/places");
  });
});
