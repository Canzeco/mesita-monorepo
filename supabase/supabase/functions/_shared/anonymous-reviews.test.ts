import { assertEquals } from "jsr:@std/assert@1";
import { anonymousReviews } from "./anonymous-reviews.ts";

// Legal (MESITA-2916): no reviewer name or photo reaches a guest.
Deno.test("anonymousReviews keeps stars, comment and date only", () => {
  const out = anonymousReviews([
    {
      author: "Rose M",
      author_photo: "https://lh3.googleusercontent.com/a/x",
      photo_url: "https://example.com/p.jpg",
      rating: 1,
      text: "Dangerous",
      published: "2026-06-01",
    },
    { author: "Juan", rating: 4, quote: "Fine", date: "a week ago" },
    null,
  ]);
  assertEquals(out, [
    { rating: 1, text: "Dangerous", published: "2026-06-01" },
    { rating: 4, text: "Fine", published: "a week ago" },
  ]);
  assertEquals(JSON.stringify(out).includes("Rose"), false);
});

Deno.test("anonymousReviews reads a missing list as empty", () => {
  assertEquals(anonymousReviews(null), []);
});
