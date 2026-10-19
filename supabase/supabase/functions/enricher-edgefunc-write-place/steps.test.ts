import { assertEquals } from "jsr:@std/assert@1";
import { enrichStepOutcomes, readTaskSteps } from "./steps.ts";

const SYNCED = {
  source_sync: {
    lastSyncedAt: "2026-10-19T00:00:00Z",
    sources: [
      { source: "google", status: "synced", error: null },
      { source: "instagram", status: "no_link", error: null },
      { source: "facebook", status: "synced", error: null },
      { source: "google_reviews", status: "synced", error: null },
    ],
  },
};

const STRONG = {
  ...SYNCED,
  google_name: "Pujol",
  business_state: "OPERATIONAL",
  google_reviews: [{ author: "A", rating: 5, quote: "Great", date: "2026-10-01" }],
  description: "A tasting menu in Polanco.",
  category: "fine_dining",
  tags: ["tasting-menu"],
  embedding: "[0.1]",
  name_embedding: "[0.2]",
};

function states(out: Record<string, { state: string } | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(out).map(([key, value]) => [key, value?.state ?? "?"]));
}

Deno.test("a Strong run stamps every step from what landed and the task's own reports", () => {
  const out = enrichStepOutcomes({
    written: STRONG,
    steps: {
      serp: { state: "completed", detail: "The Scout wrote 40 words of web context." },
      links: { state: "completed", detail: "Found 2 new link(s)." },
    },
    gallery: { sent: 6, stored: 6 },
  });
  assertEquals(states(out), {
    details: "completed",
    serp: "completed",
    links: "completed",
    social: "completed",
    reviews: "completed",
    images: "completed",
    description: "completed",
    embedding: "completed",
  });
  assertEquals(out.reviews?.detail, "1 Google review(s) on the profile.");
});

Deno.test("Weak buys no Scout and no Links, so it stamps neither", () => {
  const out = enrichStepOutcomes({ written: STRONG, steps: {}, gallery: { sent: 3, stored: 3 } });
  assertEquals("serp" in out, false);
  assertEquals("links" in out, false);
  assertEquals(out.details?.state, "completed");
});

Deno.test("a Sync error fails its step; no link and no photos are results", () => {
  const out = enrichStepOutcomes({
    written: {
      ...STRONG,
      source_sync: {
        sources: [
          { source: "instagram", status: "error", error: "Apify refused: the invoice is unpaid" },
          { source: "facebook", status: "no_link", error: null },
          { source: "google_reviews", status: "error", error: "Google reviews could not be loaded" },
        ],
      },
    },
    steps: {},
    gallery: { sent: 0, stored: 0 },
  });
  assertEquals(out.social?.state, "failed");
  assertEquals(out.social?.detail, "Instagram: Apify refused: the invoice is unpaid");
  assertEquals(out.reviews?.state, "failed");
  assertEquals(out.images?.state, "completed");
  assertEquals(out.images?.detail, "No photos to keep.");
});

Deno.test("photos that did not reach storage, a missing Presentation and missing vectors fail", () => {
  const out = enrichStepOutcomes({
    written: { ...SYNCED, google_name: "Pujol" },
    steps: { links: { state: "failed", detail: "The Resolver did not answer." } },
    gallery: { sent: 4, stored: 0 },
  });
  assertEquals(out.images?.state, "failed");
  assertEquals(out.description?.state, "failed");
  assertEquals(out.embedding?.state, "failed");
  assertEquals(out.links?.state, "failed");
});

Deno.test("no Sync result stamps neither social nor reviews", () => {
  const out = enrichStepOutcomes({ written: { description: "x", embedding: "[1]" }, steps: {}, gallery: { sent: 0, stored: 0 } });
  assertEquals("social" in out, false);
  assertEquals("reviews" in out, false);
});

Deno.test("only well-formed serp and links reports are read", () => {
  assertEquals(
    readTaskSteps({
      serp: { state: "completed", detail: " ok " },
      links: { state: "maybe", detail: "x" },
      images: { state: "completed", detail: "not the task's to say" },
    }),
    { serp: { state: "completed", detail: "ok" } },
  );
  assertEquals(readTaskSteps(null), {});
  assertEquals(readTaskSteps([]), {});
});
