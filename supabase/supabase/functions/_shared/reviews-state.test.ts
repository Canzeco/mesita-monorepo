import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  omitReviewsTileColumns,
  socialAccountReplaced,
  socialSourcesToEmpty,
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

Deno.test("socialAccountReplaced ignores a replay of the same account", () => {
  const stored = "https://www.instagram.com/strana/";
  assertEquals(socialAccountReplaced(stored, "https://instagram.com/strana"), false);
  assertEquals(socialAccountReplaced(stored, null), false);
  assertEquals(socialAccountReplaced(stored, undefined), false);
  assertEquals(socialAccountReplaced(null, "https://instagram.com/strana"), false);
  assertEquals(socialAccountReplaced(stored, "https://instagram.com/other"), true);
  assertEquals(
    socialAccountReplaced(
      "https://www.facebook.com/profile.php?id=111",
      "https://m.facebook.com/profile.php?id=111&ref=page",
    ),
    false,
  );
  assertEquals(
    socialAccountReplaced(
      "https://www.facebook.com/profile.php?id=111",
      "https://facebook.com/profile.php?id=222",
    ),
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
  assertEquals(socialSourcesToEmpty(prev, {}), { instagram: false, facebook: false });
});
