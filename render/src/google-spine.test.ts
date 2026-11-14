import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { fetchGoogleDetails, googleDescription, googleFacts } from "./google-spine.ts";

const PATCH = {
  google_name: "Casa Luminar",
  address: "Av. Ámsterdam 1, CDMX",
  google_address: { addressComponents: [{ types: ["locality", "political"], longText: "Ciudad de México" }] },
  phone: "+52 55 0000 0000",
  website_url: "https://example.com",
  google_stars_overall: 4.6,
  pitch: "Cocina de mercado en la Condesa.",
  story: "A longer generated story.",
};

test("Render never calls Google Places itself: Details is Update's step (MESITA-3844)", () => {
  for (const file of readdirSync(new URL(".", import.meta.url))) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    const src = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    assert.equal(src.includes("places.googleapis.com"), false, file);
  }
});

test("the description falls back editorial first, then generative", () => {
  assert.equal(googleDescription(PATCH), "Cocina de mercado en la Condesa.");
  assert.equal(googleDescription({ ...PATCH, pitch: null }), "A longer generated story.");
  assert.equal(googleDescription({ pitch: " ", story: null }), null);
});

test("the facts name what Google said and nothing else", () => {
  const facts = googleFacts(PATCH, "Cocina de mercado en la Condesa.");
  assert.match(facts, /^Name: Casa Luminar$/m);
  assert.match(facts, /^locality: Ciudad de México$/m);
  assert.match(facts, /^Phone: \+52 55 0000 0000$/m);
  assert.match(facts, /^Google rating: 4.6$/m);
  assert.match(facts, /^Google summary: Cocina/m);
});

test("fetchGoogleDetails returns the shared step's answer and throws on a refusal", async () => {
  process.env.SUPABASE_URL = "https://db.example";
  process.env.ENRICH_WRITE_KEY = "k";
  let asked: unknown = null;
  const ok = (async (_url: string, init: RequestInit) => {
    asked = JSON.parse(String(init.body));
    return new Response(JSON.stringify({
      ok: true,
      patch: PATCH,
      businessStatus: "OPERATIONAL",
      primaryType: "restaurant",
      photoUrls: ["https://lh3.example/1"],
      countryCode: "MX",
    }));
  }) as unknown as typeof fetch;
  const got = await fetchGoogleDetails("ChIJ-test", 8, ok);
  assert.deepEqual(asked, { googlePlaceId: "ChIJ-test", maxPhotos: 8 });
  assert.equal(got.countryCode, "MX");
  assert.deepEqual(got.photoUrls, ["https://lh3.example/1"]);

  const refused = (async () =>
    new Response(JSON.stringify({ ok: false, error: "Place has no address on Google." }), { status: 422 })) as unknown as typeof fetch;
  await assert.rejects(fetchGoogleDetails("x", 1, refused), /no address/);
});
