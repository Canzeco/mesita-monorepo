import { assertEquals } from "jsr:@std/assert";
import { ANONYMOUS_GUEST_NAME } from "./consumer-privacy.ts";
import { mapTicketReviewsToVisitors } from "./mesita-review-visitors.ts";

Deno.test("mapTicketReviewsToVisitors: anonymizes private accounts", () => {
  const [card] = mapTicketReviewsToVisitors([
    {
      food: 5,
      service: 4,
      ambience: 5,
      value: 4,
      comments: "Loved it",
      consumer: {
        privacy_public: false,
        full_name: "Ada Lovelace",
        instagram_handle: "ada",
        class_key: "premium",
        instagram_followers_count: 1200,
      },
    },
  ]);
  assertEquals(card.name, ANONYMOUS_GUEST_NAME);
  assertEquals(card.handle, "");
  assertEquals(card.class_key, "bronze");
  assertEquals(card.quote, "Loved it");
});

Deno.test("mapTicketReviewsToVisitors: public keeps identity", () => {
  const [card] = mapTicketReviewsToVisitors([
    {
      food: 5,
      service: 5,
      ambience: 5,
      value: null,
      comments: "  Great  ",
      consumer: {
        privacy_public: true,
        first_name: "Ada",
        last_name: "Lovelace",
        instagram_handle: "ada",
        class_key: "influencer",
      },
    },
  ]);
  assertEquals(card.name, "Ada Lovelace");
  assertEquals(card.handle, "@ada");
  assertEquals(card.value, 5);
  assertEquals(card.quote, "Great");
});
