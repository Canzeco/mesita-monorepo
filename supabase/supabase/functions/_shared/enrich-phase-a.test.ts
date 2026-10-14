import { assertEquals } from "jsr:@std/assert@1";
import { apifyBillingDetail } from "./apify.ts";
import { discoveryRecordedOk } from "./enrich-channel-discovery.ts";
import { igProfileMatchesPlace } from "./enrich-instagram-match.ts";
import { firecrawlSearch } from "./firecrawl-search.ts";

Deno.test("Apify's invoice refusal is named, and any other error is not", () => {
  assertEquals(
    apifyBillingDetail("platform-feature-disabled: Too many outstanding invoices"),
    "Apify refused the call: too many outstanding invoices.",
  );
  assertEquals(apifyBillingDetail("actor timed out"), null);
  assertEquals(apifyBillingDetail(null), null);
});

Deno.test("discovery.ok fails only when the Resolver was called and did not answer", () => {
  assertEquals(discoveryRecordedOk(true), true);
  assertEquals(discoveryRecordedOk(null), true);
  assertEquals(discoveryRecordedOk(false), false);
});

Deno.test("an OpenAI failure is infra, and a real false stays false", async () => {
  const place = {
    name: "Zzqx",
    locationLine: "",
    website: null,
    facebook: null,
    category: null,
  };
  const profile = { username: "otherbiz", fullName: "Other Biz", biography: "unrelated" };
  const realFetch = globalThis.fetch;

  globalThis.fetch = () => Promise.resolve(new Response("nope", { status: 500 }));
  try {
    assertEquals(await igProfileMatchesPlace(profile, place, "k"), "infra");
  } finally {
    globalThis.fetch = realFetch;
  }

  globalThis.fetch = () =>
    Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: '{"match":false}' } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
  try {
    assertEquals(await igProfileMatchesPlace(profile, place, "k"), false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("Firecrawl search reads v2 web hits and logs a refusal as empty", async () => {
  const realFetch = globalThis.fetch;
  let url = "";
  let body = "";
  globalThis.fetch = (input, init) => {
    url = String(input);
    body = String(init?.body ?? "");
    return Promise.resolve(new Response(JSON.stringify({
      data: { web: [{ url: "https://pujol.com.mx" }] },
    }), { status: 200, headers: { "content-type": "application/json" } }));
  };
  try {
    assertEquals(await firecrawlSearch("k", "pujol", 3), ["https://pujol.com.mx"]);
    assertEquals(url, "https://api.firecrawl.dev/v2/search");
    assertEquals(JSON.parse(body).sources, [{ type: "web" }]);
  } finally {
    globalThis.fetch = realFetch;
  }

  globalThis.fetch = () => Promise.resolve(new Response("no credits", { status: 402 }));
  try {
    assertEquals(await firecrawlSearch("k", "pujol"), []);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("a skipped Serp restores its summary before channel discovery", async () => {
  const src = await Deno.readTextFile(
    new URL("../enricher-cron-enrich-place-first/index.ts", import.meta.url),
  );
  const restore = src.indexOf("row.gathered?.grounding.serpSummary");
  const discover = src.indexOf("resolveChannels(");
  assertEquals(restore > 0 && discover > restore, true);
  assertEquals(src.includes("ok: true, via:"), false);
});
