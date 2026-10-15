import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmedLink,
  discoverOfficialLinks,
  poolFromUrls,
  urlsFromFirecrawl,
  validateLink,
} from "./links.ts";

test("a channel URL is kept and the wrong shape is dropped", () => {
  assert.equal(validateLink("instagram_url", "https://www.instagram.com/pujol/"), "https://www.instagram.com/pujol");
  assert.equal(validateLink("instagram_url", "https://www.instagram.com/p/Cabc123/"), null);
  assert.equal(validateLink("website_url", "https://www.tripadvisor.com/pujol"), null);
  assert.equal(
    validateLink("opentable_url", "https://www.opentable.com/r/pujol-mexico-city"),
    "https://www.opentable.com/r/pujol-mexico-city",
  );
  assert.equal(validateLink("opentable_url", "https://www.opentable.com/pujol"), null);
  assert.equal(validateLink("uber_eats_url", "https://www.ubereats.com/mx/store/pujol/abc"), "https://www.ubereats.com/mx/store/pujol/abc");
  assert.equal(validateLink("uber_eats_url", "https://www.ubereats.com/mx/category/food"), null);
});

test("the pool is shape-valid and de-duplicated", () => {
  assert.deepEqual(poolFromUrls("website_url", [
    "https://www.pujol.com.mx/menu",
    "https://pujol.com.mx/menu?utm=1",
    "https://www.instagram.com/pujol",
  ]), ["https://www.pujol.com.mx/menu"]);
});

test("Perplexity cannot introduce a URL Firecrawl did not return", () => {
  const pool = ["https://www.instagram.com/pujol"];
  assert.equal(confirmedLink("instagram_url", pool, "https://instagram.com/pujol/"), "https://www.instagram.com/pujol");
  assert.equal(confirmedLink("instagram_url", pool, "https://www.instagram.com/someone-else"), null);
  assert.equal(confirmedLink("instagram_url", pool, null), null);
  assert.equal(confirmedLink("website_url", ["https://www.pujol.com.mx/"], "https://pujol.com.mx"), "https://www.pujol.com.mx/");
});

test("Firecrawl v2 web hits and a flat data array both yield URLs", () => {
  assert.deepEqual(urlsFromFirecrawl({ data: { web: [{ url: "https://a.example" }], news: [{ url: "https://b.example" }] } }), [
    "https://a.example",
    "https://b.example",
  ]);
  assert.deepEqual(urlsFromFirecrawl({ data: [{ url: "https://c.example" }] }), ["https://c.example"]);
});

test("a sourced link is kept and an invented one is dropped", async () => {
  const searches: { query: string; limit: number }[] = [];
  let judged: { preset?: string; instructions?: string; input?: string; max_steps?: number } = {};
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      query?: string;
      limit?: number;
      preset?: string;
      instructions?: string;
      input?: string;
      max_steps?: number;
    };
    if (url.includes("firecrawl")) {
      const query = body.query ?? "";
      searches.push({ query, limit: body.limit ?? 0 });
      const hits = query.includes("instagram")
        ? [{ url: "https://www.instagram.com/pujol/" }, { url: "https://www.instagram.com/p/Cabc/" }]
        : query.includes("website")
        ? [{ url: "https://www.pujol.com.mx/menu" }, { url: "https://www.tripadvisor.com/Restaurant" }]
        : [];
      return Response.json({ data: { web: hits } });
    }
    judged = body;
    return Response.json({
      output: [{
        type: "message",
        content: [{
          text: JSON.stringify({
            website_url: "https://pujol.com.mx/menu?utm=1",
            instagram_url: "https://www.instagram.com/not-this-place",
            facebook_url: null,
            opentable_url: null,
            uber_eats_url: null,
          }),
        }],
      }],
    });
  };

  const found = await discoverOfficialLinks({
    name: "Pujol",
    city: "Mexico City",
    have: { website_url: null, instagram_url: null, facebook_url: null, opentable_url: null, uber_eats_url: null },
    counts: { website_url: 5, instagram_url: 7, facebook_url: 3, opentable_url: 3, uber_eats_url: 3 },
    preset: "pro-search",
    instructions: "Never fabricate a URL.",
    firecrawlKey: "fc",
    perplexityKey: "px",
    fetchImpl,
  });
  assert.equal(found.website_url, "https://www.pujol.com.mx/menu");
  assert.equal(found.instagram_url, undefined);
  assert.equal(searches.filter((search) => search.query.includes("instagram")).length, 1);
  assert.equal(searches.find((search) => search.query.includes("instagram"))?.limit, 7);
  assert.equal(judged.preset, "pro-search");
  assert.equal(judged.max_steps, 10);
  assert.match(judged.instructions ?? "", /Never fabricate a URL/);
  assert.match(judged.input ?? "", /https:\/\/www\.pujol\.com\.mx\/menu/);
});

test("a count of zero does not search that source", async () => {
  const queries: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string };
    if (url.includes("firecrawl")) {
      queries.push(body.query ?? "");
      return Response.json({ data: { web: [{ url: "https://www.pujol.com.mx/" }] } });
    }
    return Response.json({
      output: [{
        type: "message",
        content: [{ text: JSON.stringify({ website_url: "https://www.pujol.com.mx/" }) }],
      }],
    });
  };
  const found = await discoverOfficialLinks({
    name: "Pujol",
    city: "Mexico City",
    have: {},
    counts: { website_url: 5, instagram_url: 0, facebook_url: 0, opentable_url: 0, uber_eats_url: 0 },
    firecrawlKey: "fc",
    perplexityKey: "px",
    fetchImpl,
  });
  assert.equal(found.website_url, "https://www.pujol.com.mx/");
  assert.equal(queries.length, 1);
  assert.equal(queries[0]?.includes("instagram"), false);
});

test("a citation is kept only when Firecrawl already returned it", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("firecrawl")) {
      return Response.json({
        data: {
          web: [
            { url: "https://www.pujol.com.mx/menu" },
            { url: "https://www.instagram.com/pujol" },
          ],
        },
      });
    }
    return Response.json({
      output: [{
        type: "message",
        content: [{
          text: JSON.stringify({
            website_url: null,
            instagram_url: null,
            facebook_url: null,
            opentable_url: null,
            uber_eats_url: null,
          }),
          annotations: [
            { url: "https://pujol.com.mx/menu" },
            { url: "https://www.instagram.com/not-in-the-pool" },
          ],
        }],
      }],
    });
  };
  const found = await discoverOfficialLinks({
    name: "Pujol",
    city: "Mexico City",
    have: {},
    firecrawlKey: "fc",
    perplexityKey: "px",
    fetchImpl,
  });
  assert.equal(found.website_url, "https://www.pujol.com.mx/menu");
  assert.equal(found.instagram_url, undefined);
});

test("Google's own link is not searched again", async () => {
  const queries: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string };
    if (url.includes("firecrawl")) {
      queries.push(body.query ?? "");
      return Response.json({ data: { web: [] } });
    }
    throw new Error("Perplexity should not run when every pool is empty");
  };
  const found = await discoverOfficialLinks({
    name: "Pujol",
    city: "Mexico City",
    have: {
      website_url: "https://pujol.com.mx",
      instagram_url: null,
      facebook_url: null,
      opentable_url: null,
      uber_eats_url: null,
    },
    firecrawlKey: "fc",
    perplexityKey: "px",
    fetchImpl,
  });
  assert.deepEqual(found, {});
  assert.equal(queries.some((query) => query.includes("official website")), false);
  assert.equal(queries.some((query) => query.includes("instagram")), true);
});

test("missing vendor keys write no links and make no request", async () => {
  const found = await discoverOfficialLinks({
    name: "Pujol",
    city: null,
    have: {},
    fetchImpl: async () => {
      throw new Error("network");
    },
  });
  assert.deepEqual(found, {});
});
