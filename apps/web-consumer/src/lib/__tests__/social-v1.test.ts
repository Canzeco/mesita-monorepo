import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  approxFollowers,
  feedInstagram,
  feedSentence,
  feedStatus,
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
    guestClass: "regular",
    plan: "free",
    anonymous: false,
  };

  // MESITA-2515: old-Instagram rows, the verbs over unchanged keys.
  // MESITA-2567: only liked and viewed; there is no visited.
  // MESITA-2590: the name leads; the full @handle rides on the quiet line.
  it("reads liked and viewed over the stored keys, and nothing else", () => {
    expect(VERB).toEqual({ saved: "liked", viewed: "viewed" });
  });

  // MESITA-2532: one person, one place, one event — never "and N others".
  it("is one person and a verb, never a count", () => {
    expect(feedSentence({ person: lead, kind: "saved" })).toBe("Perdón liked");
    expect(feedSentence({ person: lead, kind: "viewed" })).toBe(
      "Perdón viewed",
    );
    expect(
      feedSentence({ person: { ...lead, isYou: true }, kind: "saved" }),
    ).toBe("You liked");
  });

  // MESITA-2525: the Instagram glyph replaces the word, so the text is the
  // proof alone; the time follows it on the quiet line.
  it("Instagram is social proof: the full @handle and ~followers (MESITA-2590)", () => {
    expect(feedWho(lead)).toBe("Perdón");
    expect(feedInstagram(lead)).toBe("@perdon · 1.2K followers");
    expect(feedInstagram({ ...lead, followers: 0 })).toBe("@perdon");
    // Without Instagram, and on the guest's own row: no second line.
    expect(feedInstagram({ ...lead, handle: null })).toBeNull();
    expect(feedInstagram({ ...lead, isYou: true })).toBeNull();
  });

  // MESITA-2543: the quiet line above the list.
  it("says sample, or how long ago the list loaded", () => {
    const t = Date.parse("2026-10-21T06:00:00Z");
    expect(feedStatus(null, t)).toBe("Updated just now");
    expect(feedStatus(t, t + 20_000)).toBe("Updated just now");
    expect(feedStatus(t, t + 3 * 60_000)).toBe("Updated 3m ago");
    expect(feedStatus(t, 0)).toBe("Updated just now");
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

// MESITA-2580: members without Instagram are in the feed as "A member".
describe("anonymous members in the feed", () => {
  const FEED_SRC = readFileSync(
    join(__dirname, "../../components/consumer/home/SocialFeed.tsx"),
    "utf8",
  );

  it("draws them with a plain face and no person card", () => {
    expect(FEED_SRC).toContain("const door = !item.person.anonymous;");
    expect(FEED_SRC).toContain("data-social-anonymous");
    expect(FEED_SRC).toMatch(/door \? \(\s*<button[\s\S]*data-social-person/);
    // The plain icon on every anonymous row, the guest's own included.
    expect(FEED_SRC).toContain("{person.anonymous ? (");
  });

  it("names them 'A member' and shows no Instagram proof", () => {
    const anon: ActivityPerson = {
      name: "A member",
      avatarUrl: null,
      handle: null,
      followers: 0,
      isYou: false,
      guestClass: "regular",
      plan: "free",
      anonymous: true,
    };
    expect(feedSentence({ person: anon, kind: "saved" })).toBe(
      "A member liked",
    );
    expect(feedInstagram(anon)).toBeNull();
  });
});

// MESITA-2591: three things per row — face left, what happened centre,
// the place's photo right ("thats it").
describe("a feed row is face, sentence, photo", () => {
  const SRC = readFileSync(
    join(__dirname, "../../components/consumer/home/SocialFeed.tsx"),
    "utf8",
  );
  const row = SRC.slice(
    SRC.indexOf("function FeedRow("),
    SRC.indexOf("/** The person card"),
  );

  it("the sentence names the place, the photo alone sits on the right", () => {
    expect(row).toContain(
      '<span className="font-semibold">{item.place.name}</span>',
    );
    expect(row.indexOf("data-social-person")).toBeLessThan(
      row.indexOf("data-social-place"),
    );
    const place = row.slice(row.indexOf("data-social-place"));
    expect(place.slice(0, place.indexOf("</Link>"))).toContain(
      "<Thumb place={item.place} />",
    );
    // No bordered place card, no chevron, no second name on the right.
    expect(row).not.toContain("<ChevronRight");
    expect(row).not.toContain("border-border bg-card");
    expect(row.match(/\{item\.place\.name\}/g)).toHaveLength(2); // sentence + aria-label
    expect(row.match(/onClick=\{\(\) => onPerson\(item\)\}/g)).toHaveLength(1);
  });

  it("an anonymous row opens the place, never a person card", () => {
    expect(row).toMatch(/\) : \(\s*<Link[\s\S]*data-social-anonymous-row/);
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
// Settings › Social lets a guest appear as "A member".
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

  it("the card's Open Instagram is a new-tab link to the profile, counted", () => {
    const card = FEED.slice(FEED.indexOf("function PersonCard("));
    expect(card).toContain(
      "https://www.instagram.com/${encodeURIComponent(person.handle)}/",
    );
    expect(card).toContain('target="_blank"');
    expect(card).toContain('rel="noopener noreferrer"');
    expect(card).toContain('trackEvent(supabase, "social_open_instagram", {})');
    // Never on the guest's own card.
    expect(card).toContain("person.handle && !person.isYou");
  });

  it("the row's handle is plain text, never a link", () => {
    const row = FEED.slice(
      FEED.indexOf("function FeedRow("),
      FEED.indexOf("/** The person card"),
    );
    expect(row).not.toContain("instagram.com");
    expect(row.match(/<a\b/g)).toBeNull();
  });

  it("Settings › Social: 'Show my name in Social', off means 'A member'", () => {
    expect(SETTINGS).toContain('<SettingsGroup title="Social">');
    expect(SETTINGS).toContain("<SocialNameRow />");
    expect(SWITCH).toContain("Show my name in Social");
    expect(SWITCH).toContain("appear_anonymous: !next");
    expect(SWITCH).toContain('role="switch"');
  });
});
