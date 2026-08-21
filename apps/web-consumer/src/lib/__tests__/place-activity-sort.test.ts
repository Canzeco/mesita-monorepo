import { describe, expect, it } from "vitest";

import type {
  PlaceReservation,
  PlaceStory,
  PlaceVisit,
} from "@/lib/api/place-activity";
import {
  sortReservations,
  sortStories,
  sortVisits,
  timeMs,
} from "@/lib/place-activity-sort";

// The place profile's activity rails are unreachable in this environment —
// visit_tickets and reservation_tickets are empty, so every box renders its
// empty state in prod today. These fixtures are the only place the POPULATED
// behaviour is exercised before the first real ticket lands.

const guest = (name: string, followers = 0) => ({
  name,
  handle: `@${name.toLowerCase()}`,
  class_key: "bronze" as const,
  followers,
});

const story = (
  id: string,
  posted_at: string,
  followers: number,
): PlaceStory => ({
  ...guest(id, followers),
  id,
  screenshot_url: `https://cdn.example/${id}.jpg`,
  posted_at,
  verified: true,
});

const visit = (
  id: string,
  visited_at: string,
  discount_percent: number,
  reviewed = false,
): PlaceVisit => ({
  ...guest(id),
  id,
  visited_at,
  discount_percent,
  reviewed,
});

const reservation = (
  id: string,
  reserved_at: string,
  party_size: number,
): PlaceReservation => ({
  ...guest(id),
  id,
  reserved_at,
  party_size,
});

const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id);

describe("timeMs", () => {
  it("parses an ISO timestamp", () => {
    expect(timeMs("2026-08-01T00:00:00Z")).toBe(
      Date.parse("2026-08-01T00:00:00Z"),
    );
  });

  it("returns 0 for the empty / unparseable timestamps the EF can send", () => {
    // The EF falls through story_submitted_at → verified_at → created_at and
    // can still land on "" when a row predates all three.
    expect(timeMs("")).toBe(0);
    expect(timeMs("not a date")).toBe(0);
  });
});

describe("sortStories", () => {
  const a = story("a", "2026-08-01T00:00:00Z", 100);
  const b = story("b", "2026-08-03T00:00:00Z", 50);
  const c = story("c", "2026-08-02T00:00:00Z", 900);
  const rows = [a, b, c];

  it("newest puts the most recent story first", () => {
    expect(ids(sortStories(rows, "newest"))).toEqual(["b", "c", "a"]);
  });

  it("oldest is the exact reverse", () => {
    expect(ids(sortStories(rows, "oldest"))).toEqual(["a", "c", "b"]);
  });

  it("reach ranks by follower count, not recency", () => {
    expect(ids(sortStories(rows, "reach"))).toEqual(["c", "a", "b"]);
  });

  it("breaks a reach tie with recency", () => {
    const tied = [
      story("old", "2026-08-01T00:00:00Z", 500),
      story("new", "2026-08-05T00:00:00Z", 500),
    ];
    expect(ids(sortStories(tied, "reach"))).toEqual(["new", "old"]);
  });

  it("does not mutate its input", () => {
    const original = [...rows];
    sortStories(rows, "reach");
    expect(rows).toEqual(original);
  });
});

describe("sortVisits", () => {
  const rows = [
    visit("a", "2026-08-01T00:00:00Z", 20),
    visit("b", "2026-08-03T00:00:00Z", 10, true),
    visit("c", "2026-08-02T00:00:00Z", 50),
  ];

  it("newest puts the most recent visit first", () => {
    expect(ids(sortVisits(rows, "newest"))).toEqual(["b", "c", "a"]);
  });

  it("reward ranks by discount percent", () => {
    expect(ids(sortVisits(rows, "reward"))).toEqual(["c", "a", "b"]);
  });

  it("reviewed floats reviewed visits up, then falls back to recency", () => {
    const many = [
      visit("plain-old", "2026-08-01T00:00:00Z", 0),
      visit("reviewed-old", "2026-08-02T00:00:00Z", 0, true),
      visit("plain-new", "2026-08-04T00:00:00Z", 0),
      visit("reviewed-new", "2026-08-03T00:00:00Z", 0, true),
    ];
    expect(ids(sortVisits(many, "reviewed"))).toEqual([
      "reviewed-new",
      "reviewed-old",
      "plain-new",
      "plain-old",
    ]);
  });

  it("keeps a 0% reward last rather than treating it as missing", () => {
    const withZero = [
      visit("zero", "2026-08-09T00:00:00Z", 0),
      visit("ten", "2026-08-01T00:00:00Z", 10),
    ];
    expect(ids(sortVisits(withZero, "reward"))).toEqual(["ten", "zero"]);
  });
});

describe("sortReservations", () => {
  const NOW = Date.parse("2026-08-15T00:00:00Z");
  const rows = [
    reservation("past-near", "2026-08-14T00:00:00Z", 2),
    reservation("future-far", "2026-08-30T00:00:00Z", 8),
    reservation("future-near", "2026-08-16T00:00:00Z", 4),
    reservation("past-far", "2026-08-01T00:00:00Z", 6),
  ];

  it("newest ignores the split and just sorts by timestamp", () => {
    expect(ids(sortReservations(rows, "newest", NOW))).toEqual([
      "future-far",
      "future-near",
      "past-near",
      "past-far",
    ]);
  });

  it("upcoming puts the soonest FUTURE booking first, past bookings behind", () => {
    expect(ids(sortReservations(rows, "upcoming", NOW))).toEqual([
      "future-near",
      "future-far",
      "past-near",
      "past-far",
    ]);
  });

  it("upcoming treats a booking exactly at the reference instant as future", () => {
    const atNow = [
      reservation("later", "2026-08-20T00:00:00Z", 2),
      reservation("exactly-now", "2026-08-15T00:00:00Z", 2),
    ];
    expect(ids(sortReservations(atNow, "upcoming", NOW))).toEqual([
      "exactly-now",
      "later",
    ]);
  });

  it("party size ranks the biggest table first", () => {
    expect(ids(sortReservations(rows, "party", NOW))).toEqual([
      "future-far",
      "past-far",
      "future-near",
      "past-near",
    ]);
  });

  it("a zero reference instant makes everything future — order stays sane", () => {
    // upcomingFrom starts at 0 and is only stamped when the guest taps
    // Upcoming; a render in between must not throw or scramble the rail.
    expect(ids(sortReservations(rows, "upcoming", 0))).toEqual([
      "past-far",
      "past-near",
      "future-near",
      "future-far",
    ]);
  });
});
