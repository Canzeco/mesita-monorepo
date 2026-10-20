import { describe, expect, it } from "vitest";

import {
  cameraStep,
  clampReloadIdleSec,
  gpsFixMovesCamera,
  idleReloadDue,
  isTargetVisible,
  RELOAD_IDLE_SEC_DEFAULT,
  RELOAD_MIN_KM,
  selectionMovesCamera,
} from "./camera-intent";
import { sameCoords } from "@/lib/use-user-location";

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

  it("a reveal of an off-screen place pans and keeps the zoom", () => {
    const far = { lat: 25.7, lng: -100.3 };
    expect(cameraStep({ gen: 1, kind: "reveal", ...far }, VIEW, 15)).toEqual({
      kind: "pan",
      ...far,
      zoom: null,
    });
  });

  it("a centre never changes the zoom the guest chose", () => {
    const there = { lat: 25.7, lng: -100.3 };
    expect(cameraStep({ gen: 1, kind: "center", ...there }, VIEW, 11)).toEqual({
      kind: "pan",
      ...there,
      zoom: null,
    });
  });

  it("a centre already at the centre is a no-op", () => {
    expect(cameraStep({ gen: 1, kind: "center", ...CENTER }, VIEW, 15)).toEqual(
      {
        kind: "none",
      },
    );
  });

  it("the first-load centre zooms in only when the map is further out", () => {
    const fix = { lat: 25.7, lng: -100.3 };
    expect(
      cameraStep({ gen: 1, kind: "center", ...fix, minZoom: 14 }, VIEW, 11),
    ).toEqual({ kind: "pan", ...fix, zoom: 14 });
    expect(
      cameraStep({ gen: 1, kind: "center", ...fix, minZoom: 14 }, VIEW, 16),
    ).toEqual({ kind: "pan", ...fix, zoom: null });
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

  it("reloads after 0.2 km of travel, not after a nudge", () => {
    expect(RELOAD_MIN_KM).toBe(0.2);
    expect(idleReloadDue(null, CENTER)).toBe(true);
    // ~110 m north.
    expect(idleReloadDue(CENTER, { lat: 25.671, lng: -100.32 })).toBe(false);
    // ~330 m north.
    expect(idleReloadDue(CENTER, { lat: 25.673, lng: -100.32 })).toBe(true);
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
