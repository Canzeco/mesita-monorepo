import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  applyGatheredReviews,
  emptyReviewMetrics,
  reviewSourcePatch,
  type ReviewVerify,
  socialConnectionRefusal,
  verifyChangedSocialLinks,
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

Deno.test("a profile edit awaits the verifier only for a URL that changed", async () => {
  const calls: string[] = [];
  const checked = await verifyChangedSocialLinks({
    prev: {
      instagram_url: "https://instagram.com/same",
      facebook_url: "https://facebook.com/old",
    },
    next: {
      instagram_url: "https://instagram.com/same",
      facebook_url: "https://facebook.com/new",
    },
    verifyInstagram: (url) => {
      calls.push(url);
      return Promise.resolve(found(1));
    },
    verifyFacebook: (url) => {
      calls.push(url);
      return Promise.resolve(found(40));
    },
  });
  assertEquals(calls, ["https://facebook.com/new"]);
  assert(checked.ok);
  if (!checked.ok) return;
  assertEquals(checked.patch.facebook_url, "https://facebook.com/new");
  assertEquals(checked.patch.facebook_found, true);
  assertEquals(checked.patch.facebook_followers, 40);
  assert(!("instagram_url" in checked.patch));
});

Deno.test("a profile edit refuses a link that is not connected and writes nothing", async () => {
  const checked = await verifyChangedSocialLinks({
    prev: { instagram_url: null, facebook_url: null },
    next: {
      instagram_url: "https://instagram.com/gone",
      facebook_url: "https://facebook.com/also-gone",
    },
    verifyInstagram: () => Promise.resolve(missed("not_a_profile")),
    verifyFacebook: () => Promise.resolve(missed("no_page")),
  });
  assertEquals(checked.ok, false);
  if (checked.ok) return;
  assertEquals(checked.code, "social_not_connected");
  assertEquals(checked.retryable, false);
  assertEquals(checked.fields, ["instagram_url", "facebook_url"]);
  assert(checked.error.includes("Instagram"));
  assert(checked.error.includes("Facebook"));
  assert(!("patch" in checked));
});

Deno.test("a connected account does not save beside one that is not", async () => {
  const checked = await verifyChangedSocialLinks({
    prev: { instagram_url: null, facebook_url: null },
    next: {
      instagram_url: "https://instagram.com/strana",
      facebook_url: "https://facebook.com/gone",
    },
    verifyInstagram: () => Promise.resolve(found(12)),
    verifyFacebook: () => Promise.resolve(missed("no_page")),
  });
  assertEquals(checked.ok, false);
  if (checked.ok) return;
  assertEquals(checked.fields, ["facebook_url"]);
  assertEquals(checked.retryable, false);
});

Deno.test("a vendor miss can be tried again", () => {
  const refusal = socialConnectionRefusal(
    "instagram",
    "client timeout after 20000ms",
  );
  assertEquals(refusal.retryable, true);
  assert(refusal.text.includes("Try again"));
});

Deno.test("a vendor miss refuses the save without locking the same link", async () => {
  const checked = await verifyChangedSocialLinks({
    prev: { instagram_url: null, facebook_url: null },
    next: { instagram_url: "https://instagram.com/strana" },
    verifyInstagram: () =>
      Promise.resolve(missed("client timeout after 20000ms")),
  });
  assertEquals(checked.ok, false);
  if (checked.ok) return;
  assertEquals(checked.retryable, true);
  assertEquals(checked.fields, ["instagram_url"]);
});

Deno.test("clearing a link does not call the verifier", async () => {
  let called = false;
  const checked = await verifyChangedSocialLinks({
    prev: { instagram_url: "https://instagram.com/a", facebook_url: null },
    next: { instagram_url: null },
    verifyInstagram: () => {
      called = true;
      return Promise.resolve(found(1));
    },
  });
  assertEquals(called, false);
  assert(checked.ok);
  if (!checked.ok) return;
  assertEquals(checked.patch.instagram_url, null);
  assertEquals(checked.patch.instagram_found, false);
  assertEquals(checked.patch.instagram_followers_count, null);
});

Deno.test("third persists gathered flags and numbers in the profile patch", () => {
  const place: Record<string, unknown> = { description: "kept" };
  applyGatheredReviews(place, {
    google: {
      found: true,
      metrics: {
        ...emptyReviewMetrics(),
        google_stars_overall: 4.6,
        google_review_count: 80,
      },
    },
    instagram: {
      url: "https://instagram.com/strana",
      found: true,
      metrics: { ...emptyReviewMetrics(), instagram_followers_count: 50 },
    },
    facebook: {
      url: "https://facebook.com/missing",
      found: false,
      metrics: emptyReviewMetrics(),
    },
  }, { instagram_url: null, facebook_url: null });
  assertEquals(place.description, "kept");
  assertEquals(place.google_found, true);
  assertEquals(place.google_stars_overall, 4.6);
  assertEquals(place.google_review_count, 80);
  assertEquals(place.instagram_found, true);
  assertEquals(place.instagram_followers_count, 50);
  assertEquals(place.facebook_found, false);
  assertEquals(place.facebook_followers, null);
  assertEquals(place.facebook_url, "https://facebook.com/missing");
});

Deno.test("third without a verifier result still drops a replaced account's count", () => {
  const place: Record<string, unknown> = {
    instagram_url: "https://instagram.com/other",
  };
  applyGatheredReviews(
    place,
    {},
    { instagram_url: "https://instagram.com/strana", facebook_url: null },
  );
  assertEquals(place.instagram_found, false);
  assertEquals(place.instagram_followers_count, null);
});
