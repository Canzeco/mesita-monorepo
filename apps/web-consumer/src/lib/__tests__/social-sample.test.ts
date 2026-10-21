import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { feedRows } from "@/components/consumer/home/SocialFeed";
import type { ActivityFeedItem } from "@/lib/api/activity";
import type { Place } from "@/lib/api/places";
import {
  SAMPLE_MEMBERS,
  sampleActivity,
  sampleLiked,
} from "@/lib/social-sample";

// Social's sample activity (MESITA-2520): made-up members on REAL places,
// while no real row opens a person card (MESITA-2583), always after the real
// rows, never interleaved.

const NOW = Date.parse("2026-10-20T12:00:00Z");

function place(id: string, distance_km: number | null = 1.2): Place {
  return { id, slug: id, name: `Place ${id}`, distance_km } as Place;
}

describe("sampleActivity", () => {
  it("draws nothing without places", () => {
    expect(sampleActivity([], NOW)).toEqual([]);
  });

  it("puts every row on one of the given places, newest first", () => {
    const places = [place("a"), place("b"), place("c")];
    const rows = sampleActivity(places, NOW);
    expect(rows.length).toBe(8);
    for (const r of rows) {
      expect(places).toContain(r.place);
      expect(r.placeId).toBe(r.place.id);
    }
    const times = rows.map((r) => Date.parse(r.at));
    expect([...times].sort((x, y) => y - x)).toEqual(times);
    expect(new Set(rows.map((r) => r.kind))).toEqual(
      new Set(["saved", "viewed"]),
    );
  });

  it("uses the fixed cast: Instagram usernames, initials, never a photo or You", () => {
    const rows = sampleActivity([place("a")], NOW);
    for (const r of rows) {
      expect(r.person.avatarUrl).toBeNull();
      expect(r.person.isYou).toBe(false);
      // Three letters of a cast username, never the whole (MESITA-2522).
      expect(r.person.handleHint).toMatch(/^[a-z0-9._]{3}$/);
      expect(SAMPLE_MEMBERS.map((m) => m.handle.slice(0, 3))).toContain(
        r.person.handleHint,
      );
      // One person, one place, one event (MESITA-2532).
      expect(Object.keys(r)).not.toContain("others");
      expect(Object.keys(r)).not.toContain("people");
    }
  });

  it("carries the place's distance, or null", () => {
    expect(sampleActivity([place("a", 2.5)], NOW)[0].distanceKm).toBe(2.5);
    expect(sampleActivity([place("a", null)], NOW)[0].distanceKm).toBeNull();
  });
});

describe("sampleLiked (MESITA-2583)", () => {
  it("gives each member up to four distinct real places", () => {
    const places = ["a", "b", "c", "d", "e"].map((id) => place(id));
    const liked = sampleLiked(2, places);
    expect(liked.map((p) => p.id)).toEqual(["c", "d", "e", "a"]);
    expect(sampleLiked(0, [place("a")]).map((p) => p.id)).toEqual(["a"]);
    expect(sampleLiked(0, [])).toEqual([]);
  });

  it("rides on every sample row, so the card never asks the server", () => {
    for (const r of sampleActivity([place("a"), place("b")], NOW)) {
      expect(r.sampleLiked.length).toBeGreaterThan(0);
    }
  });
});

describe("feedRows", () => {
  const named = sampleActivity([place("r")], NOW).slice(0, 1).map(
    ({ sampleLiked: _l, ...item }) => item,
  ) as ActivityFeedItem[];
  const anon: ActivityFeedItem[] = named.map((it) => ({
    ...it,
    person: { ...it.person, name: "A member", anonymous: true },
  }));
  const you: ActivityFeedItem[] = named.map((it) => ({
    ...it,
    person: { ...it.person, isYou: true },
  }));

  it("a real member with a card wins and the sample is gone", () => {
    expect(feedRows(named, [place("a")], NOW)).toEqual({
      rows: named,
      sampleRows: [],
    });
  });

  it("only A member or You → the real rows, then the sample", () => {
    for (const rows of [anon, you]) {
      const out = feedRows(rows, [place("a")], NOW);
      expect(out.rows).toEqual(rows);
      expect(out.sampleRows.length).toBe(8);
    }
  });

  it("an empty feed shows the sample over the places", () => {
    const out = feedRows([], [place("a")], NOW);
    expect(out.rows).toEqual([]);
    expect(out.sampleRows.length).toBe(8);
  });

  it("no feed and no places → nothing, so the empty state draws", () => {
    expect(feedRows([], [], NOW)).toEqual({ rows: [], sampleRows: [] });
  });

  it("the sample is labelled on screen", () => {
    const src = readFileSync(
      join(__dirname, "../../components/consumer/home/SocialFeed.tsx"),
      "utf8",
    );
    expect(src).toContain("data-social-sample");
    expect(src).toContain("Sample activity");
  });
});
