import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  emptyReviewsState,
  failedReviewSource,
  normalizeReviewsState,
  omitReviewsTileColumns,
  parseReviewsState,
  readyReviewSource,
  socialAccountReplaced,
  socialSourcesToEmpty,
  withReviewSource,
} from "./reviews-state.ts";

Deno.test("omitReviewsTileColumns drops the four tile facts and nothing else", () => {
  const out = omitReviewsTileColumns({
    google_stars_overall: 4.2,
    google_review_count: 10,
    instagram_followers_count: 5,
    facebook_followers: 7,
    google_reviews: [{ text: "kept" }],
    phone: "+52",
  });
  assertEquals(out.phone, "+52");
  assertEquals(out.google_reviews, [{ text: "kept" }]);
  assert(!("google_stars_overall" in out));
  assert(!("google_review_count" in out));
  assert(!("instagram_followers_count" in out));
  assert(!("facebook_followers" in out));
});

Deno.test("parseReviewsState refuses null and a source missing status", () => {
  assertEquals(parseReviewsState(null).ok, false);
  const state = emptyReviewsState();
  assertEquals(parseReviewsState(state).ok, true);
  assertEquals(parseReviewsState({ ...state, google: { fetched_at: null, error: null } }).ok, false);
});

Deno.test("normalizeReviewsState fills gaps and keeps a valid source", () => {
  const got = normalizeReviewsState({
    instagram: readyReviewSource("2026-10-13T00:00:00.000Z"),
  });
  assertEquals(got.instagram.status, "ready");
  assertEquals(got.google.status, "empty");
  assertEquals(got.facebook.status, "empty");
});

Deno.test("a failed reload keeps the previous success time", () => {
  const prev = readyReviewSource("2026-10-01T00:00:00.000Z");
  const failed = failedReviewSource(prev, "Couldn't reload. Try again.");
  assertEquals(failed.status, "failed");
  assertEquals(failed.fetched_at, prev.fetched_at);
  assertEquals(failed.error, "Couldn't reload. Try again.");
});

Deno.test("withReviewSource replaces one source", () => {
  const next = withReviewSource(emptyReviewsState(), "facebook", readyReviewSource("t"));
  assertEquals(next.facebook.status, "ready");
  assertEquals(next.instagram.status, "empty");
});

Deno.test("socialAccountReplaced ignores a replay of the same account", () => {
  const stored = "https://www.instagram.com/strana/";
  assertEquals(socialAccountReplaced(stored, "https://instagram.com/strana"), false);
  assertEquals(socialAccountReplaced(stored, null), false);
  assertEquals(socialAccountReplaced(stored, undefined), false);
  assertEquals(socialAccountReplaced(null, "https://instagram.com/strana"), false);
  assertEquals(
    socialAccountReplaced(stored, "https://instagram.com/other"),
    true,
  );
});

Deno.test("socialSourcesToEmpty only when the saved URL actually changed", () => {
  const prev = { instagram_url: "https://instagram.com/a", facebook_url: null };
  assertEquals(
    socialSourcesToEmpty(prev, { instagram_url: "https://instagram.com/a" }),
    { instagram: false, facebook: false },
  );
  assertEquals(
    socialSourcesToEmpty(prev, { instagram_url: "https://instagram.com/b" }),
    { instagram: true, facebook: false },
  );
  assertEquals(
    socialSourcesToEmpty(prev, { facebook_url: "https://facebook.com/c" }),
    { instagram: false, facebook: true },
  );
  assertEquals(
    socialSourcesToEmpty(prev, {}),
    { instagram: false, facebook: false },
  );
});
