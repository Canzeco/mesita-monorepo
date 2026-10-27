/**
 * @vitest-environment happy-dom
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaceDetailPageBody } from "@/components/consumer/PlaceDetailPageBody";
import { APP_CARD_ID } from "@/components/consumer/MobileFrame";
import { placeRowToDetail } from "@mesita/place-profile/map";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: () => {}, replace: () => {} }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  useBrowserSupabase: () => ({}),
  useLazyBrowserSupabase: () => async () => ({}),
}));

let root: Root | null = null;
let frames: FrameRequestCallback[] = [];

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function drainFrames() {
  for (let i = 0; i < 6 && frames.length > 0; i += 1) {
    const pending = frames;
    frames = [];
    act(() => {
      for (const cb of pending) cb(0);
    });
  }
}

describe("Reserve still opens the sheet", () => {
  it("opens ReservationSheet from the shared profile", () => {
    document.body.innerHTML = `<div id="${APP_CARD_ID}"></div><div id="host"></div>`;
    const host = document.getElementById("host");
    if (!host) throw new Error("missing host");
    root = createRoot(host);
    const place = placeRowToDetail({
      id: "p-1",
      name: "Lupita",
      enriched_at: "2026-01-01T00:00:00Z",
      reservations_enabled: true,
    });
    act(() => {
      root?.render(<PlaceDetailPageBody place={place} />);
    });
    drainFrames();
    const button = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Reserve a table"]',
    );
    expect(button).toBeTruthy();
    act(() => {
      button?.click();
    });
    drainFrames();
    expect(document.body.textContent).toContain("Reserve a table");
    expect(
      document.querySelector('[aria-label="Reserve at Lupita"]'),
    ).toBeTruthy();
  });
});
