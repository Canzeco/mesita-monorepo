import { assertEquals } from "jsr:@std/assert@1";
import { replaceGoogleReviews, syncSavedLinks, type SyncFetchers } from "./place-sync.ts";

const NOW = "2026-10-15T20:00:00.000Z";

function fetchers(over: Partial<SyncFetchers> = {}): SyncFetchers {
  return {
    googleSummary: () => Promise.resolve({ ok: true, value: { stars: 4.5, count: 10 } }),
    instagramSummary: () => Promise.resolve({ ok: true, value: { followers: 20 } }),
    facebookSummary: () => Promise.resolve({ ok: false, error: "Facebook timed out" }),
    googleReviews: () => Promise.resolve({
      ok: true,
      value: [{ author: "Ana", quote: "Good" }],
    }),
    ...over,
  };
}

Deno.test("sync keeps a successful source when another fails", async () => {
  const result = await syncSavedLinks({
    now: NOW,
    links: {
      googlePlaceId: "ChIJ",
      instagramUrl: "https://instagram.com/a",
      facebookUrl: "https://facebook.com/a",
    },
    fetchers: fetchers(),
  });
  assertEquals(result.patch.google_stars_overall, 4.5);
  assertEquals(result.patch.instagram_followers_count, 20);
  assertEquals("facebook_followers" in result.patch, false);
  assertEquals(result.sources.find((row) => row.source === "facebook")?.status, "error");
  assertEquals(result.patch.google_reviews, [{ author: "Ana", quote: "Good" }]);
  // The card reads these: an answer is found, a failure is not and keeps the
  // count (MESITA-3247). Google Found is Details', so a failed lookup cannot
  // undo the answer Details just gave in the same Enrich.
  assertEquals(result.patch.instagram_found, true);
  assertEquals(result.patch.facebook_found, false);
  assertEquals("google_found" in result.patch, false);
});

Deno.test("a missing link is no_link and is not fetched", async () => {
  let instagramCalls = 0;
  const result = await syncSavedLinks({
    now: NOW,
    links: { googlePlaceId: "ChIJ", instagramUrl: "  ", facebookUrl: null },
    fetchers: fetchers({
      instagramSummary: () => {
        instagramCalls += 1;
        return Promise.resolve({ ok: true, value: { followers: 1 } });
      },
    }),
  });
  assertEquals(instagramCalls, 0);
  assertEquals(result.sources.find((row) => row.source === "instagram")?.status, "no_link");
  assertEquals(result.sources.find((row) => row.source === "facebook")?.status, "no_link");
  // Both callers pass the link the place ends up with, so none means the place
  // has none: Found goes off and the last count stays (MESITA-3251).
  assertEquals(result.patch.instagram_found, false);
  assertEquals(result.patch.facebook_found, false);
  assertEquals("instagram_followers_count" in result.patch, false);
  assertEquals("facebook_followers" in result.patch, false);
});

Deno.test("reviews replace the list instead of appending", () => {
  const first = replaceGoogleReviews([{ quote: "a" }]);
  const second = replaceGoogleReviews([{ quote: "a" }]);
  assertEquals(second, first);
  assertEquals(second.length, 1);
});

Deno.test("a second sync with the same payload is the same patch", async () => {
  const opts = {
    now: NOW,
    links: { googlePlaceId: "ChIJ", instagramUrl: null, facebookUrl: null },
    fetchers: fetchers(),
  };
  const a = await syncSavedLinks(opts);
  const b = await syncSavedLinks(opts);
  assertEquals(a.patch, b.patch);
});
