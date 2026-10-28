import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  emptyReviewMetrics,
  reviewSourcePatch,
  type ReviewVerify,
} from "./review-sources.ts";

function found(count: number): ReviewVerify {
  return {
    found: true,
    metrics: {
      ...emptyReviewMetrics(),
      instagram_followers_count: count,
      facebook_followers: count,
    },
  };
}

function missed(reason: string): ReviewVerify {
  return { found: false, metrics: emptyReviewMetrics(), reason };
}

Deno.test("reviewSourcePatch stores the link, the flag, and the numbers together", () => {
  const patch = reviewSourcePatch({
    source: "instagram",
    link: "https://instagram.com/strana",
    result: found(1200),
  });
  assertEquals(patch.instagram_url, "https://instagram.com/strana");
  assertEquals(patch.instagram_found, true);
  assertEquals(patch.instagram_followers_count, 1200);
});

Deno.test("reviewSourcePatch keeps a link that did not resolve and nulls its numbers", () => {
  const patch = reviewSourcePatch({
    source: "facebook",
    link: "https://facebook.com/gone",
    result: missed("http_404"),
  });
  assertEquals(patch.facebook_url, "https://facebook.com/gone");
  assertEquals(patch.facebook_found, false);
  assertEquals(patch.facebook_followers, null);
  assert(!("reason" in patch));
});

Deno.test("reviewSourcePatch clears the link, the flag, and the numbers", () => {
  const patch = reviewSourcePatch({ source: "instagram", link: null });
  assertEquals(patch.instagram_url, null);
  assertEquals(patch.instagram_found, false);
  assertEquals(patch.instagram_followers_count, null);
});
