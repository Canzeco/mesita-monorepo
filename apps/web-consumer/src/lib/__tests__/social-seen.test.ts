import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { hasUnseen } from "@/lib/social-seen";

// Social, level 1 (MESITA-2536): the newest event the guest has seen, and
// the Social tab's dot for anything newer.

describe("hasUnseen", () => {
  it("is newer-than-seen; nothing seen and an event exists counts", () => {
    expect(hasUnseen("2026-10-20T10:00:00Z", "2026-10-20T09:00:00Z")).toBe(
      true,
    );
    expect(hasUnseen("2026-10-20T09:00:00Z", "2026-10-20T09:00:00Z")).toBe(
      false,
    );
    expect(hasUnseen("2026-10-20T08:00:00Z", "2026-10-20T09:00:00Z")).toBe(
      false,
    );
    expect(hasUnseen("2026-10-20T08:00:00Z", null)).toBe(true);
    expect(hasUnseen(null, null)).toBe(false);
    expect(hasUnseen("garbage", null)).toBe(false);
  });
});

describe("markSocialSeen", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stores the newest seen time and never moves it backwards", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
      addEventListener() {},
      removeEventListener() {},
    });
    vi.resetModules();
    const { markSocialSeen } = await import("@/lib/social-seen");
    markSocialSeen("2026-10-20T10:00:00Z");
    expect(store.get("mesita:social-seen-at")).toBe("2026-10-20T10:00:00Z");
    markSocialSeen("2026-10-20T09:00:00Z");
    expect(store.get("mesita:social-seen-at")).toBe("2026-10-20T10:00:00Z");
    markSocialSeen(undefined);
    expect(store.get("mesita:social-seen-at")).toBe("2026-10-20T10:00:00Z");
  });
});

describe("the Social tab's dot", () => {
  const rails = readFileSync(
    join(__dirname, "../../components/consumer/home/CatalogRails.tsx"),
    "utf8",
  );
  const hook = readFileSync(join(__dirname, "../use-social-has-new.ts"), "utf8");

  it("shows on Social, off while Social is open, with words for a screen reader", () => {
    expect(rails).toContain('useSocialHasNew(tab !== "social")');
    expect(rails).toContain('t.key === "social" && socialHasNew');
    expect(rails).toContain("data-home-social-dot");
    expect(rails).toContain("new activity");
    expect(rails).toContain("data-home-scroller");
  });

  it("checks at half the pane's rate, only while the tab is in view", () => {
    expect(hook).toContain("export const SOCIAL_DOT_MS = 60_000;");
    expect(hook).toContain('document.visibilityState === "visible"');
    expect(hook).toContain("if (!enabled) return;");
  });
});
