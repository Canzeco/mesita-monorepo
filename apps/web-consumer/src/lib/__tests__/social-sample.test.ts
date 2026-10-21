import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { feedRows } from "@/components/consumer/home/SocialFeed";
import type { ActivityFeedItem } from "@/lib/api/activity";
import type { Place } from "@/lib/api/places";
import { SAMPLE_MEMBERS, sampleActivity } from "@/lib/social-sample";

// Social's sample activity (MESITA-2520): made-up members on REAL places,
// only while the real feed is empty, never mixed with it.

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

describe("feedRows", () => {
  const real = sampleActivity([place("r")], NOW).slice(
    0,
    1,
  ) as ActivityFeedItem[];

  it("real activity wins and the sample is gone", () => {
    expect(feedRows(real, [place("a")], NOW)).toEqual({
      rows: real,
      sample: false,
    });
  });

  it("an empty feed shows the sample over the places", () => {
    const out = feedRows([], [place("a")], NOW);
    expect(out.sample).toBe(true);
    expect(out.rows.length).toBe(8);
  });

  it("no feed and no places → nothing, so the empty state draws", () => {
    expect(feedRows([], [], NOW)).toEqual({ rows: [], sample: false });
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
