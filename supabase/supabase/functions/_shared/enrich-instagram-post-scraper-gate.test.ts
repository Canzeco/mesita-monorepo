import { assertEquals } from "jsr:@std/assert@1";

/** Same gate as enrich-instagram.ts — post-scraper when depth exceeds embedded posts. */
function needsInstagramPostScraper(
  gatherInstagramDepth: number,
  embeddedPostCount: number,
): boolean {
  return gatherInstagramDepth > embeddedPostCount;
}

Deno.test("MESITA-2033: depth 10 skips post-scraper when profile embeds ≥10 posts", () => {
  assertEquals(needsInstagramPostScraper(10, 12), false);
  assertEquals(needsInstagramPostScraper(10, 10), false);
  assertEquals(needsInstagramPostScraper(10, 9), true);
});
