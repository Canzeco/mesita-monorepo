import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  SEARCH_COACHMARK_STORAGE_KEY,
  readSearchCoachmarkSeen,
  shouldRecordSearchCoachmarkDismiss,
  writeSearchCoachmarkSeen,
} from "@/lib/analytics/search-coachmark";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("shouldRecordSearchCoachmarkDismiss", () => {
  it("records the first timer close", () => {
    expect(
      shouldRecordSearchCoachmarkDismiss({
        alreadyRecorded: false,
        showing: true,
        reason: "timer",
      }),
    ).toBe(true);
  });

  it("records a Search tap only while the bubble is showing", () => {
    expect(
      shouldRecordSearchCoachmarkDismiss({
        alreadyRecorded: false,
        showing: true,
        reason: "tap",
      }),
    ).toBe(true);
    expect(
      shouldRecordSearchCoachmarkDismiss({
        alreadyRecorded: false,
        showing: false,
        reason: "tap",
      }),
    ).toBe(false);
  });

  it("never records a second close, timer or tap", () => {
    expect(
      shouldRecordSearchCoachmarkDismiss({
        alreadyRecorded: true,
        showing: true,
        reason: "timer",
      }),
    ).toBe(false);
    expect(
      shouldRecordSearchCoachmarkDismiss({
        alreadyRecorded: true,
        showing: true,
        reason: "tap",
      }),
    ).toBe(false);
  });
});

describe("search coachmark localStorage flag", () => {
  const store = new Map<string, string>();

  afterEach(() => {
    store.clear();
    Reflect.deleteProperty(globalThis, "window");
  });

  function setWindow(localStorage: Pick<Storage, "getItem" | "setItem">) {
    Object.assign(globalThis, { window: { localStorage } });
  }

  it("starts unseen and writes the MESITA-1610 key", () => {
    setWindow({
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    });
    expect(readSearchCoachmarkSeen()).toBe(false);
    writeSearchCoachmarkSeen();
    expect(readSearchCoachmarkSeen()).toBe(true);
    expect(store.get(SEARCH_COACHMARK_STORAGE_KEY)).toBe("1");
  });

  it("treats blocked storage as unseen, never throws", () => {
    setWindow({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readSearchCoachmarkSeen()).toBe(false);
    expect(() => writeSearchCoachmarkSeen()).not.toThrow();
  });
});

describe("MESITA-1694 — BottomNav fires the dismiss split", () => {
  const nav = read("apps/web-consumer/src/components/consumer/BottomNav.tsx");
  const track = read("apps/web-consumer/src/lib/analytics/track.ts");
  const ef = read(
    "supabase/supabase/functions/consumer-web-track-event/index.ts",
  );

  it("names search_coachmark_dismiss on the client, the EF, and both close paths", () => {
    expect(track).toContain('"search_coachmark_dismiss"');
    expect(ef).toContain('"search_coachmark_dismiss"');
    expect(nav).toContain('"search_coachmark_dismiss"');
    expect(nav).toContain('reason: "timer"');
    expect(nav).toContain('reason: "tap"');
  });

  it("does not count a timer close as a Search nav_tab_tap", () => {
    // The timer must fire the new event, not piggy-back on nav_tab_tap —
    // that event is the visit-trend query and a fake Search tap would
    // inflate the thing MESITA-1694 is trying to measure.
    const start = nav.indexOf("const t = window.setTimeout");
    const end = nav.indexOf("SEARCH_COACHMARK_AUTO_DISMISS_MS);");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const timerBlock = nav.slice(start, end);
    expect(timerBlock).toContain('"search_coachmark_dismiss"');
    expect(timerBlock).not.toMatch(/nav_tab_tap/);
  });
});
