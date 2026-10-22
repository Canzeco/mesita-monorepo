// An unanswered "allow location?" prompt must never hang Home (MESITA-2616):
// the browser does not call back at all while it waits, so the store calls
// the ask answered ("pending") after STALL_MS, and the real fix still wins.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Success = (pos: { coords: { latitude: number; longitude: number } }) => void;

describe("location ask with no answer (MESITA-2616)", () => {
  let answer: Success | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    answer = null;
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (ok: Success) => {
          answer = ok;
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("settles as pending after 5 s, then takes the late fix", async () => {
    const loc = await import("@/lib/use-user-location");
    const asked = loc.requestUserLocation();

    expect(loc.locationSnapshot()).toMatchObject({ locating: true, settled: false });

    vi.advanceTimersByTime(4999);
    expect(loc.locationSnapshot().settled).toBe(false);
    vi.advanceTimersByTime(1);
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
});
