// navigateTo is a plain push or replace since MESITA-3013: the app lives at
// its real paths, so there is no prefix to add and no reload to fall back to.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { navigateTo, shellEntryFor } from "../navigate";

describe("navigateTo", () => {
  it("pushes the href as is", () => {
    const router = { push: vi.fn(), replace: vi.fn() };
    navigateTo(router, "/place/casa");
    expect(router.push).toHaveBeenCalledWith("/place/casa");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("replaces when asked, keeping Back clean", () => {
    const router = { push: vi.fn(), replace: vi.fn() };
    navigateTo(router, "/place/casa", { replace: true });
    expect(router.replace).toHaveBeenCalledWith("/place/casa");
    expect(router.push).not.toHaveBeenCalled();
  });
});

// MESITA-4622: a full page load mid-walk keeps the Back trail when the entry
// under it was shown by the app; a sign-in starts a new one.
describe("shellEntryFor", () => {
  it("keeps no entry without the Navigation API", () => {
    expect(shellEntryFor(null, 1, "navigate", true)).toBeNull();
  });
  it("a plain load continues the trail when the entry under is ours", () => {
    expect(shellEntryFor(3, 1, "navigate", true)).toBe(1);
  });
  it("a plain load with nothing of ours under starts a new trail", () => {
    expect(shellEntryFor(3, 1, "navigate", false)).toBe(3);
  });
  it("starts a new trail with nothing kept, or a kept entry above this one", () => {
    expect(shellEntryFor(3, null, "navigate", true)).toBe(3);
    expect(shellEntryFor(3, 4, "navigate", true)).toBe(3);
  });
  it("a reload or Back/Forward load keeps the trail as before (MESITA-4602)", () => {
    expect(shellEntryFor(3, 1, "reload", false)).toBe(1);
    expect(shellEntryFor(3, 1, "back_forward", false)).toBe(1);
    expect(shellEntryFor(3, null, "reload", false)).toBe(3);
  });
});

describe("the Back trail", () => {
  type Entry = { key: string; url: string; index: number };
  let entries: Entry[];
  let current: Entry;
  let store: Map<string, string>;
  let loadType: string;

  function at(keys: string[], index: number) {
    entries = keys.map((key, i) => ({ key, url: `https://mesita.ai/${key}`, index: i }));
    current = entries[index];
  }

  beforeEach(() => {
    vi.resetModules();
    store = new Map();
    loadType = "navigate";
    at(["a"], 0);
    vi.stubGlobal("window", {
      navigation: {
        get currentEntry() {
          return current;
        },
        entries: () => entries,
      },
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
      history: { length: 5 },
      location: { pathname: "/wallet/buy", search: "" },
    });
    vi.stubGlobal("performance", { getEntriesByType: () => [{ type: loadType }] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function fresh() {
    vi.resetModules();
    return import("../navigate");
  }

  it("a full load over a screen the app showed keeps the trail, so Back pops", async () => {
    let nav = await fresh();
    at(["pay", "buy", "offers"], 0);
    nav.markShellEntry();
    for (const i of [0, 1, 2]) {
      current = entries[i];
      nav.noteShownEntry();
    }
    // Next's full-load fallback: a new document on a new entry over Offers.
    nav = await fresh();
    at(["pay", "buy", "offers", "card"], 3);
    nav.markShellEntry();
    current = entries[2]; // back on Offers
    const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
    nav.goBack(router, "/place/x");
    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("a load over an entry the app never showed starts a new trail", async () => {
    const nav = await fresh();
    at(["elsewhere", "offers"], 1);
    nav.markShellEntry();
    const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
    nav.goBack(router, "/place/x");
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/place/x", { transitionTypes: ["nav-pop"] });
  });

  it("a sign-in forgets the trail: Back never reaches the previous guest's screens", async () => {
    const nav = await fresh();
    at(["wallet", "me", "sign", "home"], 0);
    nav.markShellEntry();
    for (const i of [0, 1, 2]) {
      current = entries[i];
      nav.noteShownEntry();
    }
    nav.forgetTrail();
    const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
    // Before the next screen marks itself, Back takes the fallback, never history.length.
    nav.goBack(router, "/home");
    expect(router.back).not.toHaveBeenCalled();
    current = entries[3];
    nav.markShellEntry();
    nav.goBack(router, "/home");
    expect(router.back).not.toHaveBeenCalled();
    expect(store.get("mesita.shell-entry")).toBe("3");
  });

  it("keeps the newest 200 shown entries; showing one again makes it newest", async () => {
    const nav = await fresh();
    const keys = Array.from({ length: 201 }, (_, i) => `k${i}`);
    at(keys, 0);
    for (let i = 0; i < 201; i++) {
      current = entries[i];
      nav.noteShownEntry();
    }
    let kept = JSON.parse(store.get("mesita.shown-entries") ?? "[]") as string[];
    expect(kept).toHaveLength(200);
    expect(kept).not.toContain("k0");
    current = entries[1];
    nav.noteShownEntry();
    kept = JSON.parse(store.get("mesita.shown-entries") ?? "[]") as string[];
    expect(kept.at(-1)).toBe("k1");
  });

  it("reads a damaged store as empty", async () => {
    store.set("mesita.shown-entries", "{not json");
    const nav = await fresh();
    at(["x", "y"], 1);
    nav.markShellEntry();
    expect(store.get("mesita.shell-entry")).toBe("1");
  });
});
