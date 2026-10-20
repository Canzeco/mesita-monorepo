import { describe, expect, it } from "vitest";

import {
  cameraStep,
  clampReloadIdleSec,
  gpsFixMovesCamera,
  isTargetVisible,
  isUnderSight,
  RELOAD_IDLE_SEC_DEFAULT,
  reloadWaitMs,
  selectionMovesCamera,
} from "./camera-intent";
import { sameCoords } from "@/lib/use-user-location";
import {
  boxAtSight,
  boxBounds,
  centerForSight,
  viewportSight,
} from "./search-utils";

// A ~2.2 km × ~2 km view over Monterrey's centre.
const VIEW = { south: 25.66, west: -100.33, north: 25.68, east: -100.31 };
const CENTER = { lat: 25.67, lng: -100.32 };

describe("the camera moves only on an explicit ask (MESITA-2440)", () => {
  it("a rail scroll never moves the camera; a pin or card tap may", () => {
    expect(selectionMovesCamera("scroll")).toBe(false);
    expect(selectionMovesCamera("pin")).toBe(true);
    expect(selectionMovesCamera("card")).toBe(true);
  });

  it("a later GPS fix never moves the map", () => {
    expect(
      gpsFixMovesCamera({
        asked: false,
        firstFix: false,
        userMoved: false,
        picked: false,
      }),
    ).toBe(false);
  });

  it("the first fix centres only while nothing else claimed the camera", () => {
    const first = { asked: false, firstFix: true };
    expect(
      gpsFixMovesCamera({ ...first, userMoved: false, picked: false }),
    ).toBe(true);
    expect(
      gpsFixMovesCamera({ ...first, userMoved: true, picked: false }),
    ).toBe(false);
    expect(
      gpsFixMovesCamera({ ...first, userMoved: false, picked: true }),
    ).toBe(false);
  });

  it("the fix the location disc asked for always centres", () => {
    expect(
      gpsFixMovesCamera({
        asked: true,
        firstFix: false,
        userMoved: true,
        picked: true,
      }),
    ).toBe(true);
  });
});

describe("isTargetVisible", () => {
  it("sees the centre and misses a place outside the view", () => {
    expect(isTargetVisible(VIEW, CENTER)).toBe(true);
    expect(isTargetVisible(VIEW, { lat: 25.7, lng: -100.32 })).toBe(false);
    expect(isTargetVisible(VIEW, { lat: 25.67, lng: -100.2 })).toBe(false);
  });

  it("counts a place under the bottom rail as off-screen", () => {
    // 10% up from the south edge: inside the box, under the rail.
    expect(isTargetVisible(VIEW, { lat: 25.662, lng: -100.32 })).toBe(false);
    expect(
      isTargetVisible(
        VIEW,
        { lat: 25.662, lng: -100.32 },
        { top: 0, bottom: 0, left: 0, right: 0 },
      ),
    ).toBe(true);
  });

  it("handles a view across the dateline", () => {
    const wrap = { south: -1, west: 179, north: 1, east: -179 };
    expect(isTargetVisible(wrap, { lat: 0, lng: 180 })).toBe(true);
    expect(isTargetVisible(wrap, { lat: 0, lng: -179.95 })).toBe(true);
    expect(isTargetVisible(wrap, { lat: 0, lng: -179.05 })).toBe(false);
    expect(isTargetVisible(wrap, { lat: 0, lng: 0 })).toBe(false);
  });
});

describe("cameraStep", () => {
  it("a reveal of an on-screen place does nothing", () => {
    expect(cameraStep({ gen: 1, kind: "reveal", ...CENTER }, VIEW, 15)).toEqual(
      {
        kind: "none",
      },
    );
  });

  it("a reveal of an off-screen place pans it under the sight and keeps the zoom", () => {
    const far = { lat: 25.7, lng: -100.3 };
    expect(cameraStep({ gen: 1, kind: "reveal", ...far }, VIEW, 15)).toEqual({
      kind: "pan",
      ...centerForSight(VIEW, far),
      zoom: null,
    });
  });

  it("a centre never changes the zoom the guest chose", () => {
    const there = { lat: 25.7, lng: -100.3 };
    expect(cameraStep({ gen: 1, kind: "center", ...there }, VIEW, 11)).toEqual({
      kind: "pan",
      ...centerForSight(VIEW, there),
      zoom: null,
    });
  });

  it("a centre already under the sight is a no-op", () => {
    const sight = viewportSight(VIEW);
    expect(cameraStep({ gen: 1, kind: "center", ...sight }, VIEW, 15)).toEqual({
      kind: "none",
    });
  });

  it("the first-load centre zooms in only when the map is further out", () => {
    const fix = { lat: 25.7, lng: -100.3 };
    expect(
      cameraStep({ gen: 1, kind: "center", ...fix, minZoom: 14 }, VIEW, 11),
    ).toEqual({
      kind: "pan",
      ...centerForSight(VIEW, fix, 2 ** (11 - 14)),
      zoom: 14,
    });
    expect(
      cameraStep({ gen: 1, kind: "center", ...fix, minZoom: 14 }, VIEW, 16),
    ).toEqual({ kind: "pan", ...centerForSight(VIEW, fix), zoom: null });
  });

  it("a Location fits its viewport", () => {
    const bounds = { south: 25.5, west: -100.5, north: 25.8, east: -100.1 };
    expect(cameraStep({ gen: 1, kind: "fit", bounds }, VIEW, 15)).toEqual({
      kind: "fit",
      bounds,
    });
  });

  it("with no view yet a reveal still pans", () => {
    expect(
      cameraStep({ gen: 1, kind: "reveal", ...CENTER }, null, null),
    ).toEqual({ kind: "pan", ...CENTER, zoom: null });
  });
});

describe("idle reload", () => {
  it("waits 1.5 s by default and clamps the operator's value", () => {
    expect(RELOAD_IDLE_SEC_DEFAULT).toBe(1.5);
    expect(clampReloadIdleSec(undefined)).toBe(1.5);
    expect(clampReloadIdleSec(Number.NaN)).toBe(1.5);
    expect(clampReloadIdleSec(0)).toBe(0.5);
    expect(clampReloadIdleSec(99)).toBe(10);
    expect(clampReloadIdleSec(3)).toBe(3);
  });

  // MESITA-2451: "if more than n seconds have happened since last reload".
  it("times the wait from the last reload, with no distance gate", () => {
    // No reload yet: at once.
    expect(reloadWaitMs(null, 10_000, 1500)).toBe(0);
    // The gap already passed: at once, however short the move.
    expect(reloadWaitMs(10_000, 12_000, 1500)).toBe(0);
    // Inside the gap: only the rest of it.
    expect(reloadWaitMs(10_000, 10_400, 1500)).toBe(1100);
  });
});

describe("sameCoords", () => {
  it("keeps one object for one place, so a repeat fix is not a move", () => {
    expect(sameCoords(CENTER, { ...CENTER })).toBe(true);
    expect(sameCoords(CENTER, { lat: 25.67, lng: -100.321 })).toBe(false);
    expect(sameCoords(null, null)).toBe(true);
    expect(sameCoords(null, CENTER)).toBe(false);
  });
});

describe("a pin's second tap flies there (MESITA-2488)", () => {
  it("knows when a place already sits under the sight", () => {
    const sight = viewportSight(VIEW);
    expect(isUnderSight(VIEW, sight)).toBe(true);
    expect(
      isUnderSight(VIEW, { lat: sight.lat + 0.0005, lng: sight.lng }),
    ).toBe(true);
    // A quarter of the view away is a real fly.
    expect(isUnderSight(VIEW, { lat: sight.lat + 0.005, lng: sight.lng })).toBe(
      false,
    );
    expect(isUnderSight(VIEW, { lat: sight.lat, lng: sight.lng + 0.005 })).toBe(
      false,
    );
    expect(isUnderSight(null, sight)).toBe(false);
  });

  it("the fly is a centre ask: it pans to the sight and keeps the zoom", () => {
    const target = { lat: 25.675, lng: -100.315 };
    const step = cameraStep({ gen: 1, kind: "center", ...target }, VIEW, 15);
    expect(step.kind).toBe("pan");
    if (step.kind !== "pan") return;
    expect(step.zoom).toBeNull();
    const want = centerForSight(VIEW, target);
    expect(step.lat).toBeCloseTo(want.lat, 9);
    expect(step.lng).toBeCloseTo(want.lng, 9);
  });
});

describe("a load asks for the visible map (MESITA-2499)", () => {
  it("sends the view as the EF's bounds", () => {
    expect(boxBounds(VIEW)).toEqual({
      low: { lat: 25.66, lng: -100.33 },
      high: { lat: 25.68, lng: -100.31 },
    });
  });

  it("sends no bounds without a view, across the dateline, or degenerate", () => {
    expect(boxBounds(null)).toBeNull();
    expect(boxBounds({ south: 10, west: 179, north: 11, east: -179 })).toBeNull();
    expect(boxBounds({ south: 10, west: 5, north: 10, east: 6 })).toBeNull();
  });

  it("a load ahead of its camera move asks for the view it lands on", () => {
    const target = { lat: 25.7, lng: -100.4 };
    const box = boxAtSight(VIEW, target)!;
    // Same zoom: the same width, and the target under the sight.
    expect(box.east - box.west).toBeCloseTo(VIEW.east - VIEW.west, 9);
    const sight = viewportSight(box);
    expect(sight.lat).toBeCloseTo(target.lat, 9);
    expect(sight.lng).toBeCloseTo(target.lng, 9);
    expect(boxAtSight(null, target)).toBeNull();
  });
});
