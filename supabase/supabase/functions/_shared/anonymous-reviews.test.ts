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

// Business reads them anonymously too (MESITA-3145): every line of a Business
// door that answers `google_reviews` runs the list through anonymousReviews.
// The one line allowed without it is the DB write (`patch: { google_reviews`).
Deno.test("Business doors answer google_reviews only through anonymousReviews", async () => {
  for (const door of ["business-web-get-place", "business-web-reload-place-reviews"]) {
    const src = await Deno.readTextFile(new URL(`../${door}/index.ts`, import.meta.url));
    const lines = src.split("\n").filter((l) => !l.trim().startsWith("//") && /google_reviews\s*:/.test(l));
    const replies = lines.filter((l) => !l.includes("patch: { google_reviews"));
    assertEquals(replies.length > 0, true, `${door} answers google_reviews`);
    for (const l of replies) assertEquals(l.includes("anonymousReviews("), true, `${door}: ${l.trim()}`);
  }
});
