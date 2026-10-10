// staff-web-benchmark-link-strategies
// Diagnostic EF: given one or more places (name + city), runs the link-discovery
// strategies in linklab/strategies.ts and returns each strategy's {website, instagram}.
// `only: ["C","G"]` runs just those (MESITA-2118) — the rest are skipped, not billed.
// This is the SAME strategy module the local benchmark runner (scripts/linklab/run.ts)
// exercises — so the offline leaderboard reflects exactly what this EF would produce.
//
// Not wired to any client. Service-role bearer only (requireInternalCaller, MESITA-2118):
// verify_jwt alone let the public anon key in, and every call spends Firecrawl /
// Perplexity / Google / Anthropic money. Ad-hoc evaluation, e.g.
//   POST { "places": [{ "name": "Pujol", "city": "Ciudad de México" }], "only": ["G"] }
// Keys come from EF secrets: FIRECRAWL_KEY, PERPLEXITY_KEY, GMP_KEY, and ANTHROPIC_API_KEY
// (strategy G only).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, jsonError, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { assembleContext } from "../_shared/linklab/context.ts";
import type { Keys } from "../_shared/linklab/providers.ts";
import { runAllStrategies, STRATEGIES } from "../_shared/linklab/strategies.ts";

type Place = { name: string; city: string; country?: string };
type Body = {
  places?: Place[];
  name?: string;
  city?: string;
  country?: string;
  only?: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const callerRes = requireInternalCaller(req, envRes.env);
  if (!callerRes.ok) return callerRes.response;

  const keys: Keys = {
    firecrawl: Deno.env.get("FIRECRAWL_KEY") ?? "",
    perplexity: Deno.env.get("PERPLEXITY_KEY") ?? "",
    google: Deno.env.get("GMP_KEY") ?? Deno.env.get("SUPA_GMP_KEY") ?? "",
    anthropic: Deno.env.get("ANTHROPIC_API_KEY") ?? "",
  };
  if (!keys.firecrawl || !keys.perplexity || !keys.google) {
    return jsonError("Missing FIRECRAWL_KEY / PERPLEXITY_KEY / GMP_KEY secret", 500);
  }

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const places: Place[] = body.places?.length
    ? body.places
    : body.name && body.city
    ? [{ name: body.name, city: body.city, country: body.country }]
    : [];
  if (!places.length) {
    return jsonError("Provide { places:[{name,city}] } or { name, city }", 400);
  }
  // Hard cap: at most 3 places per message/response.
  if (places.length > 3) return jsonError("Max 3 places per call", 400);

  const only = body.only?.length ? body.only.map((id) => String(id).toUpperCase()) : null;
  const unknown = only?.filter((id) => !STRATEGIES.some((s) => s.id === id)) ?? [];
  if (unknown.length) return jsonError(`Unknown strategy id(s): ${unknown.join(", ")}`, 400);
  if (only?.includes("G") && !keys.anthropic) {
    return jsonError("Strategy G needs the ANTHROPIC_API_KEY secret", 500);
  }

  const strategies = STRATEGIES.filter((s) => !only || only.includes(s.id))
    .map((s) => ({ id: s.id, name: s.name }));
  const out = [];
  for (const p of places) {
    const ctx = await assembleContext(keys, p);
    const results = await runAllStrategies(ctx, keys, only);
    out.push({
      place: p,
      google_place_id: ctx.google?.placeId ?? null,
      seed_website: ctx.seedWebsite,
      location_line: ctx.locationLine,
      serp_summary: ctx.serpSummary,
      results,
    });
  }

  return json({ ok: true, strategies, count: out.length, out });
});
