import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  FEED_DAYS,
  feedDay,
  feedSections,
} from "@/components/consumer/home/SocialFeed";
import type { ActivityFeedItem } from "@/lib/api/activity";

// Social's tidy notifications (MESITA-2525, Pato: "make this more UI
// friendly … your call"): day headings, a verb badge on the face, the time
// on the quiet line, and a placeholder where a place has no photo.

/** Local wall-clock times, so the day maths match the guest's calendar. */
const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const NOW = at(2026, 10, 20, 9, 30);

describe("feedDay", () => {
  it("buckets by the guest's calendar day, not by 24-hour spans", () => {
    expect(feedDay(iso(at(2026, 10, 20, 0, 5)), NOW)).toBe("Today");
    // 9h30m ago, but before midnight: yesterday.
    expect(feedDay(iso(at(2026, 10, 19, 23, 59)), NOW)).toBe("Yesterday");
    expect(feedDay(iso(at(2026, 10, 19, 0, 0)), NOW)).toBe("Yesterday");
    expect(feedDay(iso(at(2026, 10, 18, 23, 59)), NOW)).toBe("This week");
    expect(feedDay(iso(at(2026, 10, 14, 0, 0)), NOW)).toBe("This week");
    expect(feedDay(iso(at(2026, 10, 13, 23, 59)), NOW)).toBe("Earlier");
  });

  it("a clock running ahead reads Today; garbage reads Earlier", () => {
    expect(feedDay(iso(NOW + 60_000), NOW)).toBe("Today");
    expect(feedDay("not a date", NOW)).toBe("Earlier");
  });
});

describe("feedSections", () => {
  const row = (id: string, ms: number) =>
    ({ placeId: id, at: iso(ms) }) as ActivityFeedItem;

  it("draws the days in order, keeps the server's order within one, drops empty days", () => {
    const rows = [
      row("a", at(2026, 10, 20, 9)),
      row("b", at(2026, 10, 20, 8)),
      row("c", at(2026, 10, 1)),
      row("d", at(2026, 10, 19)),
    ];
    const sections = feedSections(rows, NOW);
    expect(sections.map((s) => s.day)).toEqual([
      "Today",
      "Yesterday",
      "Earlier",
    ]);
    expect(sections.map((s) => s.rows.map((r) => r.placeId))).toEqual([
      ["a", "b"],
      ["d"],
      ["c"],
    ]);
    expect(FEED_DAYS).toEqual(["Today", "Yesterday", "This week", "Earlier"]);
  });

  it("no rows, no headings", () => {
    expect(feedSections([], NOW)).toEqual([]);
  });
});

describe("the row", () => {
  const src = readFileSync(
    join(__dirname, "../../components/consumer/home/SocialFeed.tsx"),
    "utf8",
  );

  it("wears the verb as a badge: heart liked, pin visited, eye viewed", () => {
    expect(src).toMatch(/saved: Heart,\s+went: MapPin,\s+viewed: Eye,/);
    expect(src).toContain("data-social-verb={kind}");
  });

  it("never draws an empty photo box: no photo → the card placeholder", () => {
    expect(src).toContain("placePlaceholder(place)");
    expect(src).toContain("<FamilyIcon");
    // The old row drew `{photo ? <img/> : null}` inside the tile.
    expect(src).not.toMatch(/\{photo \? \([\s\S]{0,200}\) : null\}/);
  });

  it("puts the time on the quiet line, not after the place", () => {
    expect(src).not.toContain("{item.place.name}</span>.");
    expect(src).toContain("data-social-quiet");
  });

  it("an error offers Try again", () => {
    expect(src).toContain('label: "Try again"');
  });
});
