// Location must never hang Home and must be automatic:
// - an unanswered "allow location?" prompt gets no callback at all, so the
//   store calls the ask answered after STALL_MS (MESITA-2616);
// - the cap covers the retry, and a tap after a stall asks again (MESITA-2617);
// - when the device gives nothing, the network's approximate point is the
//   fix, and a real device fix replaces it (MESITA-2625).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Success = (pos: { coords: { latitude: number; longitude: number } }) => void;

const NETWORK = { lat: 25.67, lng: -100.31 };

describe("the location store", () => {
  let answer: Success | null = null;
  let fail: ((err: { code: number }) => void) | null = null;
  let asks = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    answer = null;
    fail = null;
    asks = 0;
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (ok: Success, err: (e: { code: number }) => void) => {
          asks += 1;
          answer = ok;
          fail = err;
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** A browser page whose `/api/ip-location` answers `coords`. */
  function stubNetwork(coords: { lat: number; lng: number } | null) {
    vi.stubGlobal("window", {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ coords, city: null }) })),
    );
  }

  it("settles as pending after 5 s, then takes the late fix (MESITA-2616)", async () => {
    const loc = await import("@/lib/use-user-location");
    const asked = loc.requestUserLocation();

    expect(loc.locationSnapshot()).toMatchObject({ locating: true, settled: false });

    await vi.advanceTimersByTimeAsync(4999);
    expect(loc.locationSnapshot().settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(loc.locationSnapshot()).toMatchObject({
      locating: false,
      settled: true,
      error: "pending",
      coords: null,
    });

    answer?.({ coords: { latitude: 25.65, longitude: -100.29 } });
    await expect(asked).resolves.toEqual({ lat: 25.65, lng: -100.29 });
    expect(loc.locationSnapshot()).toMatchObject({
      coords: { lat: 25.65, lng: -100.29 },
      error: null,
      settled: true,
    });
  });

  it("a tap after a stall asks the browser again (MESITA-2617)", async () => {
    const loc = await import("@/lib/use-user-location");
    void loc.requestUserLocation();
    await vi.advanceTimersByTimeAsync(5000);
    expect(loc.locationSnapshot().error).toBe("pending");

    void loc.requestUserLocation();
    expect(asks).toBe(2);
    expect(loc.locationSnapshot().locating).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(loc.locationSnapshot()).toMatchObject({ locating: false, error: "pending" });
  });

  it("the 5 s cap covers the retry too (MESITA-2617)", async () => {
    const loc = await import("@/lib/use-user-location");
    void loc.requestUserLocation();
    await vi.advanceTimersByTimeAsync(1000);
    fail?.({ code: 2 });
    await vi.advanceTimersByTimeAsync(0);
    expect(asks).toBe(2);
    expect(loc.locationSnapshot().locating).toBe(true);
    await vi.advanceTimersByTimeAsync(4000);
    expect(loc.locationSnapshot()).toMatchObject({ locating: false, error: "pending" });
  });

  it("a denied device falls back to the network's point (MESITA-2625)", async () => {
    stubNetwork(NETWORK);
    const loc = await import("@/lib/use-user-location");
    void loc.requestUserLocation();
    fail?.({ code: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(loc.locationSnapshot()).toMatchObject({
      coords: NETWORK,
      approx: true,
      locating: false,
      settled: true,
      error: "denied",
    });
  });

  it("a stalled prompt falls back too, and a later device fix replaces it (MESITA-2625)", async () => {
    stubNetwork(NETWORK);
    const loc = await import("@/lib/use-user-location");
    void loc.requestUserLocation();
    await vi.advanceTimersByTimeAsync(5000);
    expect(loc.locationSnapshot()).toMatchObject({ coords: NETWORK, approx: true });

    answer?.({ coords: { latitude: 25.65, longitude: -100.29 } });
    await vi.advanceTimersByTimeAsync(0);
    expect(loc.locationSnapshot()).toMatchObject({
      coords: { lat: 25.65, lng: -100.29 },
      approx: false,
      error: null,
    });
  });

  it("no network point leaves no fix (MESITA-2625)", async () => {
    stubNetwork(null);
    const loc = await import("@/lib/use-user-location");
    void loc.requestUserLocation();
    fail?.({ code: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(loc.locationSnapshot()).toMatchObject({
      coords: null,
      approx: false,
      settled: true,
      error: "denied",
    });
  });
});
