// MVP test rule (MESITA-2600): only the auth/privacy guard stays; UI pins were removed (MESITA-2601).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { feedSentence, VERB } from "@/components/consumer/home/SocialFeed";
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
    // MESITA-4616: B came back with no card (disabled), so its cached card
    // is gone and the Saved row stops drawing it; the save itself stays.
    expect(mod.readSavedPlacePreviews().has(B)).toBe(false);
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

  it("a save during a read is kept, then yields to the server if its write failed; another account never gets it", async () => {
    vi.useFakeTimers();
    try {
      const { mod, saved } = await freshStore({ "mesita:saved-places-synced": "1" });
      mod.setSavedPlacesRemote(() => {});
      const { renderToString } = await import("react-dom/server");
      const { createElement } = await import("react");
      let setSaved: (id: string, on: boolean) => void = () => {};
      renderToString(
        createElement(function Probe() {
          setSaved = mod.useSavedPlaces().setSaved;
          return null;
        }),
      );
      const server = async () => ({ ids: [B], places: [] });
      await mod.syncSavedPlaces(async () => {
        setSaved(A, true);
        return server();
      }, async () => {});
      expect(saved()).toEqual([B, A]);
      vi.advanceTimersByTime(60_000);
      await mod.syncSavedPlaces(server, async () => {});
      expect(saved()).toEqual([B]);
      await mod.syncSavedPlaces(async () => {
        setSaved(A, true);
        mod.clearSavedPlacesLocal();
        return server();
      }, async () => {});
      expect(saved()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the feed's copy", () => {
  // MESITA-2515: old-Instagram rows, the verbs over unchanged keys.
  // MESITA-2567: only liked and viewed; there is no visited.
  // MESITA-2590: the name leads; the full @handle rides on the quiet line.
  it("reads liked and viewed over the stored keys, and nothing else", () => {
    expect(VERB).toEqual({ saved: "liked", viewed: "viewed" });
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

// MESITA-2580: members without Instagram are in the feed; MESITA-2612: by
// first name, never "A member".
describe("anonymous members in the feed", () => {
  const FEED_SRC = readFileSync(
    join(__dirname, "../../components/consumer/home/SocialFeed.tsx"),
    "utf8",
  );

  it("draws them with a plain face; every row opens the person card (MESITA-2609)", () => {
    expect(FEED_SRC).toContain("data-social-anonymous");
    expect(FEED_SRC).not.toContain("data-social-anonymous-row");
    // The one no-photo face, the same DefaultAvatar Me draws (MESITA-2620);
    // the photo shows when the server sends one (MESITA-2608). Never a
    // lucide glyph, never an initial.
    expect(FEED_SRC).toContain("<DefaultAvatar");
    expect(FEED_SRC).not.toContain("UserRound");
    expect(FEED_SRC).not.toContain("firstInitial");
  });

  it("names them by first name and shows no Instagram proof", () => {
    const anon: ActivityPerson = {
      name: "Sofia",
      avatarUrl: null,
      handle: null,
      handleLocked: false,
      followers: 0,
      isYou: false,
      guestClass: "regular",
      plan: "free",
      instagram: false,
      anonymous: true,
    };
    expect(feedSentence({ person: anon, kind: "saved" })).toBe("Sofia liked");
  });
});

// MESITA-2591: Social shows no mock data (reverses MESITA-2520's sample).
describe("Social has no sample", () => {
  const SRC = readFileSync(
    join(__dirname, "../../components/consumer/home/SocialFeed.tsx"),
    "utf8",
  );

  it("draws only the server's rows", () => {
    expect(existsSync(join(__dirname, "../social-sample.ts"))).toBe(false);
    expect(SRC).not.toMatch(
      /social-sample|sampleActivity|Sample activity|samplePlaces/,
    );
  });
});
