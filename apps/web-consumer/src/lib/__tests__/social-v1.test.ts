// MVP test rule (MESITA-2600): only the auth/privacy guard stays; UI pins were removed (MESITA-2601).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  feedInstagram,
  feedSentence,
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
    expect(feedInstagram(anon)).toBeNull();
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

// MESITA-2590: the person card opens Instagram in a new tab and counts it;
// Settings › Social: Public profile off hides the photo and handle.
describe("full handle, Open Instagram, and the Social name switch", () => {
  const FEED = readFileSync(
    join(__dirname, "../../components/consumer/home/SocialFeed.tsx"),
    "utf8",
  );
  const SETTINGS = readFileSync(
    join(__dirname, "../../components/consumer/me/SettingsModal.tsx"),
    "utf8",
  );
  const SWITCH = readFileSync(
    join(__dirname, "../../components/consumer/me/SocialNameRow.tsx"),
    "utf8",
  );
  const INSTAGRAM = readFileSync(
    join(__dirname, "../../components/consumer/me/InstagramModal.tsx"),
    "utf8",
  );
  // The switch's words moved to a plain module the route fallbacks read too
  // (MESITA-2701).
  const SWITCH_WORDS = readFileSync(
    join(__dirname, "../../components/consumer/me/switch-words.ts"),
    "utf8",
  );

  it("the card's Open Instagram is a new-tab link to the profile, counted", () => {
    const card = FEED.slice(FEED.indexOf("function PersonCard("));
    expect(card).toContain(
      "https://www.instagram.com/${encodeURIComponent(person.handle)}/",
    );
    expect(card).toContain('target="_blank"');
    expect(card).toContain('rel="noopener noreferrer"');
    expect(card).toContain('trackEvent(supabase, "social_open_instagram", {})');
    // Never on the guest's own card, never for a masked handle (MESITA-2594).
    expect(card).toContain(
      "person.handle && !person.isYou && !person.handleLocked",
    );
  });

  // MESITA-2594: you see others' Instagram only if you show yours. The server
  // masks; the card offers the way to unlock instead of a link.
  it("a masked handle has no link and says how to see it", () => {
    const card = FEED.slice(FEED.indexOf("function PersonCard("));
    expect(card).toContain("data-social-unlock-instagram");
    expect(card).toContain("CONSUMER_ROUTES.mePages.instagram");
    expect(card).toContain("Connect your Instagram to see theirs");
    expect(card).toContain("Make your profile public to see their Instagram");
  });

  it("Settings › Social: 'Public profile' writes appear_anonymous", () => {
    expect(SETTINGS).toContain('<SettingsGroup title="Social">');
    expect(SETTINGS).toContain("<SocialNameRow />");
    expect(SWITCH_WORDS).toContain('label: "Public profile"');
    expect(SWITCH).toContain("{PUBLIC_PROFILE_SWITCH.label}");
    // MESITA-2594: asked again where the member connects Instagram.
    expect(INSTAGRAM).toContain("<SocialNameRow />");
    expect(SWITCH).toContain("appear_anonymous: !next");
    expect(SWITCH).toContain('role="switch"');
  });
});
