// The kept screen data (MESITA-3014) must never show the wrong row: a server
// seed may not overwrite a write from this browser, a different account must
// not read the last one's rows, and nothing is ever kept on the server.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("screen cache", () => {
  beforeEach(() => {
    vi.resetModules();
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("a seed never overwrites a write from this browser", async () => {
    const c = await import("@/lib/screen-cache");
    c.writeCached("profile", { first_name: "Saved" });
    c.seedCached("profile", { first_name: "Stale server render" });
    expect(c.readCached("profile")).toEqual({ first_name: "Saved" });
  });

  it("a seed fills an empty key", async () => {
    const c = await import("@/lib/screen-cache");
    c.seedCached("profile", { first_name: "Server" });
    expect(c.readCached("profile")).toEqual({ first_name: "Server" });
  });

  it("a different account reads nothing the last one kept", async () => {
    const c = await import("@/lib/screen-cache");
    const reset = await import("@/lib/consumer-local-reset");
    reset.reconcileConsumerLocalOwner("account-a");
    c.writeCached("profile", { id: "account-a" });
    c.writeCached("reservations", ["a's booking"]);

    reset.reconcileConsumerLocalOwner("account-a");
    expect(c.readCached("profile")).toEqual({ id: "account-a" });

    reset.reconcileConsumerLocalOwner("account-b");
    expect(c.readCached("profile")).toBeNull();
    expect(c.readCached("reservations")).toBeNull();
  });

  it("keeps nothing on the server, where memory is shared by every guest", async () => {
    vi.unstubAllGlobals();
    const c = await import("@/lib/screen-cache");
    c.writeCached("profile", { id: "someone" });
    c.seedCached("reservations", ["someone's"]);
    expect(c.readCached("profile")).toBeNull();
    expect(c.readCached("reservations")).toBeNull();
  });

  it("one request per key, and its answer is kept", async () => {
    const c = await import("@/lib/screen-cache");
    let calls = 0;
    let release: (v: string) => void = () => {};
    const fetch = () => {
      calls += 1;
      return new Promise<string>((r) => (release = r));
    };
    const a = c.fetchCached("notifications", fetch);
    const b = c.fetchCached("notifications", fetch);
    expect(calls).toBe(1);
    release("rows");
    await expect(a).resolves.toBe("rows");
    await expect(b).resolves.toBe("rows");
    expect(c.readCached("notifications")).toBe("rows");
  });
});
