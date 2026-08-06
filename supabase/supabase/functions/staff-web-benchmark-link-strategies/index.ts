// staff-web-benchmark-link-strategies
// Diagnostic EF: given one or more places (name + city), runs the 5 link-discovery
// strategies in linklab/strategies.ts and returns each strategy's {website, instagram}.
// This is the SAME strategy module the local benchmark runner (scripts/linklab/run.ts)
// exercises — so the offline leaderboard reflects exactly what this EF would produce.
//
// Not wired to any client; invoke with a service-role JWT for ad-hoc evaluation, e.g.
//   POST { "places": [{ "name": "Pujol", "city": "Ciudad de México" }] }
// Legacy body key `venues` is still accepted as an alias.
// Keys come from EF secrets: FIRECRAWL_KEY, PERPLEXITY_KEY, GMP_KEY.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, methodNotAllowed, readJson } from "../_shared/http.ts";
import { assembleContext } from "../_shared/linklab/context.ts";
import type { Keys } from "../_shared/linklab/providers.ts";
import { runAllStrategies, STRATEGIES } from "../_shared/linklab/strategies.ts";

type Place = { name: string; city: string; country?: string };
type Body = {
  places?: Place[];
  /** @deprecated Use `places`. Kept for ad-hoc callers of the old key. */
  venues?: Place[];
  name?: string;
  city?: string;
  country?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return methodNotAllowed();

  const keys: Keys = {
    firecrawl: Deno.env.get("FIRECRAWL_KEY") ?? "",
    perplexity: Deno.env.get("PERPLEXITY_KEY") ?? "",
    google: Deno.env.get("GMP_KEY") ?? Deno.env.get("SUPA_GMP_KEY") ?? "",
  };
  if (!keys.firecrawl || !keys.perplexity || !keys.google) {
    return json({ ok: false, error: "Missing FIRECRAWL_KEY / PERPLEXITY_KEY / GMP_KEY secret" }, 500);
  }

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const listed = body.places?.length
    ? body.places
    : body.venues?.length
    ? body.venues
    : null;
  const places: Place[] = listed
    ? listed
    : body.name && body.city
    ? [{ name: body.name, city: body.city, country: body.country }]
    : [];
  if (!places.length) {
    return json(
      { ok: false, error: "Provide { places:[{name,city}] } or { name, city }" },
      400,
    );
  }
  // Hard cap: at most 3 places per message/response.
  if (places.length > 3) return json({ ok: false, error: "Max 3 places per call" }, 400);

  const strategies = STRATEGIES.map((s) => ({ id: s.id, name: s.name }));
  const out = [];
  for (const p of places) {
    const ctx = await assembleContext(keys, p);
    const results = await runAllStrategies(ctx, keys);
    out.push({
      place: p,
      google_place_id: ctx.google?.placeId ?? null,
      seed_website: ctx.seedWebsite,
      results,
    });
  }

  return json({ ok: true, strategies, count: out.length, out });
});
