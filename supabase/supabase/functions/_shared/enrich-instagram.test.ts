import { assertEquals } from "jsr:@std/assert@1";
import { gatherInstagram } from "./enrich-instagram.ts";

// MESITA-2162: Apify refused every scrape (403, unpaid invoices) and the FB-slug
// candidate was mixed-case. Its error was keyed "Stranasanpedro" while `tried`
// held "stranasanpedro", so infra_fail read false and the research stage dropped
// the discovered Instagram instead of attaching it unverified.
Deno.test("gatherInstagram: every scrape refused → infra_fail, whatever the handle casing", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      new Response("platform-feature-disabled: Too many outstanding invoices", { status: 403 }),
    );
  try {
    const r = await gatherInstagram({
      apifyKey: "k",
      openaiKey: undefined,
      perplexityKey: undefined,
      place: {
        name: "Strana",
        locationLine: "San Pedro Garza García",
        website: null,
        facebook: "https://facebook.com/Stranasanpedro",
        category: null,
      },
      igHandle: "stranasanpedro_oficial",
      fbHandleCandidate: "Stranasanpedro",
      gatherInstagramDepth: 12,
      gatherInstagramPosts: 6,
    });
    assertEquals(r.verifiedInstagramUrl, null);
    assertEquals(r.diag.tried, ["stranasanpedro_oficial", "stranasanpedro"]);
    assertEquals(r.diag.infra_fail, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});
