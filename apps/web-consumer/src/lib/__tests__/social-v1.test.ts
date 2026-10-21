import { afterEach, describe, expect, it, vi } from "vitest";

import {
  feedName,
  feedSentence,
  feedWho,
  shortAgo,
  VERB,
} from "@/components/consumer/home/SocialFeed";
import type { ActivityPerson } from "@/lib/api/activity";

// Social v1 (MESITA-2442): Saved lives on the server, the browser is a cache;
// the feed's copy is "Perdón and 4 others saved".

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const G = "g:ChIJgoogle";

function fakeWindow(seed: Record<string, string>) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    window: {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
      addEventListener() {},
      removeEventListener() {},
    },
  };
}

async function freshStore(seed: Record<string, string>) {
  const fake = fakeWindow(seed);
  vi.stubGlobal("window", fake.window);
  vi.resetModules();
  const mod = await import("@/lib/saved-places");
  const saved = () =>
    JSON.parse(fake.store.get("mesita:saved-places") ?? "[]") as string[];
  return { mod, saved };
}

describe("Saved is server-side", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("the first sync pushes this browser's older Mesita saves once, then adopts the server", async () => {
    const { mod, saved } = await freshStore({
      "mesita:saved-places": JSON.stringify([A, G]),
    });
    const push = vi.fn(async (_id: string) => {});
    await mod.syncSavedPlaces(
      async () => ({ ids: [B], places: [{ id: B, name: "B" }] }),
      push,
    );
    expect(push.mock.calls.map((c) => c[0])).toEqual([A]);
    expect(new Set(saved())).toEqual(new Set([A, B, G]));
    expect(mod.readSavedPlacePreviews().get(B)).toEqual({ id: B, name: "B" });

    // Later syncs never push again: the server is the truth now.
    await mod.syncSavedPlaces(async () => ({ ids: [B], places: [] }), push);
    expect(push).toHaveBeenCalledTimes(1);
    expect(new Set(saved())).toEqual(new Set([B, G]));
  });

  it("a failed server read keeps the cache", async () => {
    const { mod, saved } = await freshStore({
      "mesita:saved-places": JSON.stringify([A]),
    });
    await mod.syncSavedPlaces(
      async () => {
        throw new Error("offline");
      },
      async () => {},
    );
    expect(saved()).toEqual([A]);
  });
});

describe("the feed's copy", () => {
  const lead: ActivityPerson = {
    name: "Perdón",
    avatarUrl: null,
    handle: "perdon",
    followers: 1200,
    isYou: false,
  };

  // MESITA-2515: old-Instagram rows — the username leads, the name follows
  // muted; the verbs read liked · visited · viewed over unchanged keys.
  it("reads liked, visited and viewed over the stored keys", () => {
    expect(VERB).toEqual({ saved: "liked", went: "visited", viewed: "viewed" });
  });

  it("collapses with a count and keeps the verb, username first", () => {
    expect(feedSentence({ lead, others: 0, kind: "went" })).toBe(
      "perdon visited",
    );
    expect(feedSentence({ lead, others: 1, kind: "saved" })).toBe(
      "perdon and 1 other liked",
    );
    expect(feedSentence({ lead, others: 4, kind: "viewed" })).toBe(
      "perdon and 4 others viewed",
    );
    expect(
      feedSentence({
        lead: { ...lead, isYou: true },
        others: 0,
        kind: "saved",
      }),
    ).toBe("You liked");
  });

  it("the name follows the username; with no username the name leads", () => {
    expect(feedWho(lead)).toBe("perdon");
    expect(feedName(lead)).toBe("Perdón");
    const noHandle = { ...lead, handle: null };
    expect(feedWho(noHandle)).toBe("Perdón");
    expect(feedName(noHandle)).toBeNull();
    // The server's "@handle" fallback name is not shown twice.
    expect(feedName({ ...lead, name: "@perdon" })).toBeNull();
    expect(feedName({ ...lead, isYou: true })).toBeNull();
  });

  it("reads time the short way", () => {
    const now = Date.parse("2026-10-19T12:00:00Z");
    expect(shortAgo("2026-10-19T11:59:30Z", now)).toBe("now");
    expect(shortAgo("2026-10-19T11:55:00Z", now)).toBe("5m");
    expect(shortAgo("2026-10-19T10:00:00Z", now)).toBe("2h");
    expect(shortAgo("2026-10-16T12:00:00Z", now)).toBe("3d");
    expect(shortAgo("2026-09-28T12:00:00Z", now)).toBe("3w");
  });
});

// MESITA-2460: saves made when they were "only in this browser" are
// backfilled QUIET, so they never reach the feed.
describe("the first-sync backfill stays private", () => {
  it("pushes old saves with quiet: true", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const guard = readFileSync(
      join(__dirname, "../../components/consumer/ConsumerLocalDataGuard.tsx"),
      "utf8",
    );
    expect(guard).toMatch(
      /apiTrackActivity\(getSupabase\(\), \{\s*kind: "saved",\s*placeId,\s*quiet: true/,
    );
  });
});
