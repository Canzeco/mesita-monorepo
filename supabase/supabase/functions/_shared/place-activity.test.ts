import { assert, assertEquals } from "jsr:@std/assert";
import { ANONYMOUS_GUEST_NAME } from "./consumer-privacy.ts";
import {
  mapReservationTickets,
  mapStoryTickets,
  mapVisitTickets,
} from "./place-activity.ts";

// These mappers are the ONLY thing standing between a service-role read and a
// public place page, so the privacy gates are tested harder than the shaping.

const PUBLIC_GUEST = {
  privacy_public: true,
  first_name: "Ada",
  last_name: "Lovelace",
  instagram_handle: "ada",
  class_key: "premium",
  instagram_followers_count: 1200,
};

// ── Stories ─────────────────────────────────────────────────────────────

Deno.test("mapStoryTickets: publishes a verified story from a public guest", () => {
  const cards = mapStoryTickets([
    {
      id: "t1",
      story_status: "ai_verified",
      story_screenshot_url: "https://cdn.example/story.jpg",
      story_submitted_at: "2026-08-01T00:00:00Z",
      consumer: PUBLIC_GUEST,
    },
  ]);
  assertEquals(cards.length, 1);
  assertEquals(cards[0].name, "Ada Lovelace");
  assertEquals(cards[0].handle, "@ada");
  assertEquals(cards[0].class_key, "premium");
  assertEquals(cards[0].followers, 1200);
  assertEquals(cards[0].verified, true);
});

Deno.test("mapStoryTickets: every verified status publishes", () => {
  for (const story_status of ["ai_verified", "staff_verified", "self_verified"]) {
    const cards = mapStoryTickets([
      {
        id: "t1",
        story_status,
        story_screenshot_url: "https://cdn.example/s.jpg",
        consumer: PUBLIC_GUEST,
      },
    ]);
    assertEquals(cards.length, 1, `${story_status} should publish`);
  }
});

Deno.test("mapStoryTickets: unverified / rejected / pending never publish", () => {
  for (
    const story_status of [
      "pending",
      "submitted",
      "ai_rejected",
      "staff_rejected",
      "not_required",
      null,
    ]
  ) {
    const cards = mapStoryTickets([
      {
        id: "t1",
        story_status,
        story_screenshot_url: "https://cdn.example/s.jpg",
        consumer: PUBLIC_GUEST,
      },
    ]);
    assertEquals(cards.length, 0, `${story_status} must not publish`);
  }
});

Deno.test("mapStoryTickets: drops rows with no screenshot", () => {
  const cards = mapStoryTickets([
    {
      id: "t1",
      story_status: "ai_verified",
      story_screenshot_url: "   ",
      consumer: PUBLIC_GUEST,
    },
  ]);
  assertEquals(cards.length, 0);
});

Deno.test("mapStoryTickets: privacy_show_stories=false drops the story", () => {
  const cards = mapStoryTickets([
    {
      id: "t1",
      story_status: "ai_verified",
      story_screenshot_url: "https://cdn.example/s.jpg",
      consumer: { ...PUBLIC_GUEST, privacy_show_stories: false },
    },
  ]);
  assertEquals(cards.length, 0);
});

Deno.test("mapStoryTickets: a PRIVATE account's story is dropped, not anonymized", () => {
  // A screenshot is a picture of that guest's own Instagram — it carries the
  // handle and often the face, so there is nothing to anonymize. Dropping is
  // the only safe shaping.
  const cards = mapStoryTickets([
    {
      id: "t1",
      story_status: "staff_verified",
      story_screenshot_url: "https://cdn.example/s.jpg",
      consumer: { ...PUBLIC_GUEST, privacy_public: false },
    },
  ]);
  assertEquals(cards.length, 0);
});

Deno.test("mapStoryTickets: falls back through the timestamp chain", () => {
  const [card] = mapStoryTickets([
    {
      id: "t1",
      story_status: "ai_verified",
      story_screenshot_url: "https://cdn.example/s.jpg",
      story_verified_at: "2026-08-02T00:00:00Z",
      created_at: "2026-07-01T00:00:00Z",
      consumer: PUBLIC_GUEST,
    },
  ]);
  assertEquals(card.posted_at, "2026-08-02T00:00:00Z");
});

// ── Visits ──────────────────────────────────────────────────────────────

Deno.test("mapVisitTickets: anonymizes a private account but keeps the visit", () => {
  const [card] = mapVisitTickets([
    {
      id: "v1",
      status: "paid",
      discount_percent: 20,
      paid_at: "2026-08-01T00:00:00Z",
      consumer: { ...PUBLIC_GUEST, privacy_public: false },
    },
  ]);
  assertEquals(card.name, ANONYMOUS_GUEST_NAME);
  assertEquals(card.handle, "");
  assertEquals(card.discount_percent, 20);
});

Deno.test("mapVisitTickets: privacy_show_visits=false drops the visit", () => {
  const cards = mapVisitTickets([
    {
      id: "v1",
      status: "paid",
      paid_at: "2026-08-01T00:00:00Z",
      consumer: { ...PUBLIC_GUEST, privacy_show_visits: false },
    },
  ]);
  assertEquals(cards.length, 0);
});

Deno.test("mapVisitTickets: never leaks a bill amount", () => {
  const [card] = mapVisitTickets([
    {
      id: "v1",
      status: "paid",
      discount_percent: 10,
      paid_at: "2026-08-01T00:00:00Z",
      consumer: PUBLIC_GUEST,
      // Even if a caller widens the select, the card shape must not carry it.
      ...({ total_cents: 480000, tip_cents: 50000 } as Record<string, unknown>),
    },
  ]);
  const keys = Object.keys(card);
  assert(!keys.some((k) => k.includes("cents")), `leaked: ${keys.join(",")}`);
  assert(!keys.includes("total"), `leaked total: ${keys.join(",")}`);
});

Deno.test("mapVisitTickets: marks visits that produced a review", () => {
  const cards = mapVisitTickets(
    [
      { id: "v1", status: "paid", consumer: PUBLIC_GUEST },
      { id: "v2", status: "paid", consumer: PUBLIC_GUEST },
    ],
    new Set(["v2"]),
  );
  assertEquals(cards[0].reviewed, false);
  assertEquals(cards[1].reviewed, true);
});

Deno.test("mapVisitTickets: missing discount reads as 0, not NaN", () => {
  const [card] = mapVisitTickets([
    { id: "v1", status: "paid", discount_percent: null, consumer: PUBLIC_GUEST },
  ]);
  assertEquals(card.discount_percent, 0);
});

// ── Reservations ────────────────────────────────────────────────────────

Deno.test("mapReservationTickets: shapes a confirmed booking", () => {
  const [card] = mapReservationTickets([
    {
      id: "r1",
      status: "confirmed",
      reserved_at: "2026-09-01T02:00:00Z",
      party_size: 4,
      consumer: PUBLIC_GUEST,
    },
  ]);
  assertEquals(card.name, "Ada Lovelace");
  assertEquals(card.party_size, 4);
  assertEquals(card.reserved_at, "2026-09-01T02:00:00Z");
});

Deno.test("mapReservationTickets: rides the visits privacy flag", () => {
  const cards = mapReservationTickets([
    {
      id: "r1",
      status: "confirmed",
      reserved_at: "2026-09-01T02:00:00Z",
      party_size: 2,
      consumer: { ...PUBLIC_GUEST, privacy_show_visits: false },
    },
  ]);
  assertEquals(cards.length, 0);
});

Deno.test("mapReservationTickets: never leaks phone or notes", () => {
  const [card] = mapReservationTickets([
    {
      id: "r1",
      status: "confirmed",
      reserved_at: "2026-09-01T02:00:00Z",
      party_size: 2,
      consumer: PUBLIC_GUEST,
      ...({
        consumer_phone: "+52155000000",
        place_phone: "+52155111111",
        notes: "Window table, birthday",
      } as Record<string, unknown>),
    },
  ]);
  const keys = Object.keys(card);
  assert(!keys.includes("notes"), `leaked notes: ${keys.join(",")}`);
  assert(
    !keys.some((k) => k.includes("phone")),
    `leaked phone: ${keys.join(",")}`,
  );
});

Deno.test("mapReservationTickets: absent party_size reads as 0", () => {
  const [card] = mapReservationTickets([
    { id: "r1", status: "confirmed", party_size: null, consumer: PUBLIC_GUEST },
  ]);
  assertEquals(card.party_size, 0);
});

// ── Shared shaping ──────────────────────────────────────────────────────

Deno.test("all mappers: unknown class keys fall back to standard", () => {
  const consumer = { ...PUBLIC_GUEST, class_key: "unobtanium" };
  assertEquals(
    mapStoryTickets([
      {
        id: "t",
        story_status: "ai_verified",
        story_screenshot_url: "https://cdn.example/s.jpg",
        consumer,
      },
    ])[0].class_key,
    "standard",
  );
  assertEquals(
    mapVisitTickets([{ id: "v", status: "paid", consumer }])[0].class_key,
    "standard",
  );
  assertEquals(
    mapReservationTickets([{ id: "r", status: "confirmed", consumer }])[0]
      .class_key,
    "standard",
  );
});

Deno.test("all mappers: a supabase array-shaped join resolves to its first row", () => {
  // PostgREST returns embedded rows as an array when it can't prove the
  // relationship is to-one; mapTicketReviewsToVisitors already handles this.
  const [card] = mapVisitTickets([
    { id: "v", status: "paid", consumer: [PUBLIC_GUEST] },
  ]);
  assertEquals(card.name, "Ada Lovelace");
});

Deno.test("all mappers: a missing consumer join degrades to anonymous", () => {
  const [card] = mapVisitTickets([{ id: "v", status: "paid", consumer: null }]);
  assertEquals(card.name, ANONYMOUS_GUEST_NAME);
  assertEquals(card.class_key, "standard");
  assertEquals(card.followers, 0);
});
