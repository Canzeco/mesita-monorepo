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
  let judged: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string; messages?: { content?: string }[] };
    if (url.includes("firecrawl")) {
      const query = body.query ?? "";
      const hits = query.includes("instagram")
        ? [{ url: "https://www.instagram.com/pujol/" }, { url: "https://www.instagram.com/p/Cabc/" }]
        : query.includes("website")
        ? [{ url: "https://www.pujol.com.mx/menu" }, { url: "https://www.tripadvisor.com/Restaurant" }]
        : [];
      return Response.json({ data: { web: hits } });
    }
    judged = body.messages?.map((message) => message.content ?? "") ?? [];
    return Response.json({
      choices: [{
        message: {
          content: JSON.stringify({
            website_url: "https://pujol.com.mx/menu?utm=1",
            instagram_url: "https://www.instagram.com/not-this-place",
            facebook_url: null,
            opentable_url: null,
            uber_eats_url: null,
          }),
        },
      }],
    });
  };

  const found = await discoverOfficialLinks({
    name: "Pujol",
    city: "Mexico City",
    have: { website_url: null, instagram_url: null, facebook_url: null, opentable_url: null, uber_eats_url: null },
    firecrawlKey: "fc",
    perplexityKey: "px",
    fetchImpl,
  });
  assert.equal(found.website_url, "https://www.pujol.com.mx/menu");
  assert.equal(found.instagram_url, undefined);
  assert.match(judged.join("\n"), /reject false positives/i);
  assert.match(judged.join("\n"), /https:\/\/www\.pujol\.com\.mx\/menu/);
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
