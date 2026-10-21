import { afterEach, describe, expect, it, vi } from "vitest";

import {
  approxFollowers,
  feedInstagram,
  feedSentence,
  feedWho,
  personKey,
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
    handleHint: "per",
    followers: 1200,
    isYou: false,
  };

  // MESITA-2515: old-Instagram rows, the verbs liked · visited · viewed over
  // unchanged keys. MESITA-2522: the name leads; the username never shows.
  it("reads liked, visited and viewed over the stored keys", () => {
    expect(VERB).toEqual({ saved: "liked", went: "visited", viewed: "viewed" });
  });

  // MESITA-2532: one person, one place, one event — never "and N others".
  it("is one person and a verb, never a count", () => {
    expect(feedSentence({ person: lead, kind: "went" })).toBe("Perdón visited");
    expect(feedSentence({ person: lead, kind: "saved" })).toBe("Perdón liked");
    expect(feedSentence({ person: lead, kind: "viewed" })).toBe(
      "Perdón viewed",
    );
    expect(feedSentence({ person: { ...lead, isYou: true }, kind: "saved" })).toBe(
      "You liked",
    );
  });

  // MESITA-2525: the Instagram glyph replaces the word, so the text is the
  // proof alone; the time follows it on the quiet line.
  it("Instagram is social proof: three letters, blocked, and ~followers", () => {
    expect(feedWho(lead)).toBe("Perdón");
    expect(feedInstagram(lead)).toBe("per••• · 1.2K followers");
    expect(feedInstagram({ ...lead, followers: 0 })).toBe("per•••");
    // Without Instagram, and on the guest's own row: no second line.
    expect(feedInstagram({ ...lead, handleHint: null })).toBeNull();
    expect(feedInstagram({ ...lead, isYou: true })).toBeNull();
  });

  // MESITA-2542: one person across rows, without a member id.
  it("matches a person by name, handle hint and isYou", () => {
    expect(personKey(lead)).toBe(personKey({ ...lead, followers: 9 }));
    expect(personKey(lead)).not.toBe(personKey({ ...lead, handleHint: "pex" }));
    expect(personKey(lead)).not.toBe(personKey({ ...lead, isYou: true }));
  });

  it("rounds followers down to an approximate count", () => {
    expect(
      [0, 7, 47, 760, 999, 1000, 4820, 12_400, 999_999, 1_250_000].map(
        approxFollowers,
      ),
    ).toEqual([
      null,
      "7",
      "40+",
      "700+",
      "900+",
      "1K",
      "4.8K",
      "12K",
      "999K",
      "1.2M",
    ]);
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
