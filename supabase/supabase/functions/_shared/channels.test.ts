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
import { classifyLinks, pickWebsite } from "./channels.ts";
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

Deno.test("pickWebsite: a delivery aggregator is never the official website", () => {
  // MESITA-2030, from production: the Resolver handed back an Uber Eats store
  // page for `website_url` and the old hand-typed blocklist — which named
  // opentable.com but not ubereats.com — let it through. The place ended up
  // with the SAME store under `website_url` and `uber_eats_url`.
  //
  // Asserted ALONE, not mixed with a real site: pickWebsite returns the first
  // ACCEPTED candidate, so a real site later in the array would mask a
  // regression here exactly the way it masked one in the retired-host test
  // above.
  assertEquals(
    pickWebsite(["https://www.ubereats.com/mx-en/store/dos-amores-brunch/EXgN"]),
    null,
  );
  assertEquals(pickWebsite(["https://www.rappi.com.mx/restaurantes/12345"]), null);
  assertEquals(pickWebsite(["https://www.doordash.com/store/foo-123"]), null);
  assertEquals(pickWebsite(["https://resy.com/cities/mty/some-place"]), null);
  assertEquals(pickWebsite(["https://www.opentable.com.mx/r/some-place"]), null);

  // And the aggregator still loses to a real site that comes after it.
  assertEquals(
    pickWebsite([
      "https://www.ubereats.com/mx-en/store/dos-amores-brunch/EXgN",
      "https://dosamores.mx",
    ]),
    "https://dosamores.mx/",
  );
});

Deno.test("pickWebsite: every matchChannel host is refused, by derivation", () => {
  // The guard that stops this from drifting again. pickWebsite no longer keeps
  // its own copy of the channel hosts — it asks matchChannel — so a channel
  // added there is blocked here without anyone editing this file. One case per
  // channel proves the derivation is wired, not that the host table is right
  // (that is the "each known host maps to its declared channel" test above).
  for (
    const url of [
      "https://www.instagram.com/someplace",
      "https://www.facebook.com/someplace",
      "https://x.com/someplace",
      "https://www.threads.net/@someplace",
      "https://www.reddit.com/r/someplace",
      "https://wa.me/5214441653308",
      "https://www.opentable.com/r/someplace",
      "https://resy.com/cities/mty/someplace",
      "https://www.ubereats.com/mx/store/someplace/abc",
      "https://didifood.com.mx/store/someplace",
      "https://maps.google.com/?cid=123",
    ]
  ) {
    assertEquals(pickWebsite([url]), null, `should be refused as a website: ${url}`);
  }

  // A host nothing claims is still a website — the point of the function.
  assertEquals(pickWebsite(["https://dosamores.mx/menu"]), "https://dosamores.mx/menu");
});

Deno.test("classifyLinks: an aggregator with no Mesita column is not a website either", () => {
  // The OTHER website door. classifyLinks is the create path — it bags a
  // place's links into columns — and it guarded website_url only against
  // matchChannel hosts and retired socials. Rappi is neither, so it was
  // landing in website_url the same way Uber Eats was landing there via
  // pickWebsite. Both doors now ask one predicate (MESITA-2030).
  assertEquals(classifyLinks(["https://www.rappi.com.mx/restaurantes/12345"]).website_url, null);
  assertEquals(classifyLinks(["https://www.doordash.com/store/foo-123"]).website_url, null);
  assertEquals(classifyLinks(["https://es.wikipedia.org/wiki/Some_Place"]).website_url, null);

  // Uber Eats keeps its own column rather than being dropped — it IS a
  // channel, just not the website.
  const ue = classifyLinks(["https://www.ubereats.com/mx/store/some-place/abc"]);
  assertEquals(ue.website_url, null);
  assertEquals(ue.uber_eats_url, "https://www.ubereats.com/mx/store/some-place/abc");

  // A real site still classifies as one.
  assertEquals(classifyLinks(["https://dosamores.mx"]).website_url, "https://dosamores.mx/");
});
