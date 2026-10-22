// Location must never hang Home, and no fix means no location:
// - an unanswered "allow location?" prompt gets no callback at all, so the
//   store calls the ask answered after STALL_MS (MESITA-2616);
// - the cap covers the retry, and a tap after a stall asks again (MESITA-2617);
// - a device that gives nothing leaves no fix: no network or city stand-in
//   (MESITA-2626 removed MESITA-2625's IP estimate).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Success = (pos: { coords: { latitude: number; longitude: number } }) => void;

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

  it("a denied device leaves no location (MESITA-2626)", async () => {
    const loc = await import("@/lib/use-user-location");
    void loc.requestUserLocation();
    fail?.({ code: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(loc.locationSnapshot()).toMatchObject({
      coords: null,
      locating: false,
      settled: true,
      error: "denied",
    });
  });
});
