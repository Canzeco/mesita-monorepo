// _shared/channels.test.ts
//
// Closed-key-set guard test 2, CHANNEL leg (MESITA-1247). No test file
// existed for channels.ts's classifyLinks before this — schema-catalog.test.ts's
// existing channel test only proves ChannelSet/Channels are the same TYPE, it
// does not exercise classifyLinks's actual runtime behavior. "classifyLinks
// always returns exactly 12 keys" needs no test — Channels is a hand-written
// object literal in the function's return statement, so TypeScript already
// guarantees completeness; test behavior instead.
import { assertEquals } from "jsr:@std/assert@1";
import { classifyLinks } from "./channels.ts";
import type { ChannelKey } from "./channels.ts";

Deno.test("classifyLinks: retired hosts (tiktok/tripadvisor/yelp) never leak into website_url", () => {
  // A retired host ALONE — not "shortest wins against a real candidate".
  // The first version of this test used both a retired link and a real
  // site together and stayed green even with isRetiredSocialHost's tiktok
  // branch disabled (verified by deliberately breaking it), because the
  // real site's URL happened to be shorter and pickShortest silently masked
  // the regression. Asserting website_url is null when the ONLY input is a
  // retired host is the direct claim: a retired host must never become a
  // website CANDIDATE at all, regardless of what else is in the bag.
  assertEquals(classifyLinks(["https://www.tiktok.com/@someplace"]).website_url, null);
  assertEquals(
    classifyLinks(["https://www.tripadvisor.com.mx/Restaurant_Review-abc"]).website_url,
    null,
  );
  assertEquals(classifyLinks(["https://www.yelp.com/biz/someplace"]).website_url, null);

  // And mixed with a real site, the real site still wins — same assertion
  // as before, kept as a belt-and-suspenders realistic-input case.
  const mixed = classifyLinks([
    "https://www.tiktok.com/@someplace",
    "https://www.tripadvisor.com.mx/Restaurant_Review-abc",
    "https://www.yelp.com/biz/someplace",
    "https://realsite.example.com",
  ]);
  // canonicaliseUrl (channels.ts) normalizes a bare-domain URL's implicit
  // empty path to a trailing "/" (WHATWG URL semantics) — verified against
  // the real output rather than assumed.
  assertEquals(mixed.website_url, "https://realsite.example.com/");
});

Deno.test("classifyLinks: a fully unrecognized host lands in website_url, nowhere else", () => {
  const out = classifyLinks(["https://totally-unknown-host.example"]);
  assertEquals(out.website_url, "https://totally-unknown-host.example/");
  assertEquals(out.instagram_url, null);
  assertEquals(out.google_maps_url, null);
});

Deno.test("classifyLinks: each known host maps to its declared channel", () => {
  const fixtures: Array<[string, ChannelKey]> = [
    ["https://www.instagram.com/someplace", "instagram_url"],
    ["https://www.facebook.com/someplace", "facebook_url"],
    ["https://fb.com/someplace", "facebook_url"],
    ["https://twitter.com/someplace", "x_url"],
    ["https://x.com/someplace", "x_url"],
    ["https://www.threads.net/@someplace", "threads_url"],
    ["https://www.reddit.com/r/someplace", "reddit_url"],
    ["https://wa.me/525500000000", "whatsapp_url"],
    ["https://www.opentable.com.mx/someplace", "opentable_url"],
    ["https://resy.com/cities/mex/someplace", "resy_url"],
    ["https://www.ubereats.com/mx/store/someplace", "uber_eats_url"],
    ["https://didifood.com/someplace", "didi_food_url"],
    ["https://maps.google.com/?cid=123", "google_maps_url"],
    ["https://maps.app.goo.gl/abc123", "google_maps_url"],
  ];
  for (const [url, expectKey] of fixtures) {
    assertEquals(classifyLinks([url])[expectKey], url, `${url} -> ${expectKey}`);
  }
});
