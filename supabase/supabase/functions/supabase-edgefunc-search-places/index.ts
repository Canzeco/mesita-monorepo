// Supabase Edge Function — supabase-edgefunc-search-places (internal caller)
//
// Memo's public-catalog lookup. One of the four endpoints that make up Memo's
// entire data surface (see _shared/memo-data.ts); Memo itself holds no database
// client.
//
// Two lookup modes, either or both per call:
//   • name             — fuzzy match a place the user named (the `place_facts`
//                        tool, and the legacy pipeline's on-Mesita name sweep).
//                        Scoped to browsable rows: status ∈ {active, lead}.
//   • googlePlaceIds   — cross-reference Google Text Search hits against the
//                        catalog so cards get the right on-Mesita badge and
//                        navigable ids. Unscoped by status ON PURPOSE: this is
//                        an identity join on ids the caller already holds, and
//                        badging must stay correct for every catalog row.
//
// Results are projected to MemoPlaceCard, so the reply carries public catalog
// fields only.
//
// Naming: actor-origin-verb-noun → supabase · edgefunc · search · places.
// Auth: verify_jwt = true + requireInternalCaller (service-role bearer).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { escapeIlike } from "../_shared/google-places.ts";
import {
  MEMO_PLACE_PUBLIC_SELECT,
  type MemoPlaceCard,
  rowToMemoPlaceCard,
} from "../_shared/memo-place-card.ts";

// Rows a browsing consumer may see by name.
const BROWSABLE_STATUS = ["active", "lead"];

const DEFAULT_LIMIT = 4;
const MAX_LIMIT = 10;
const MAX_PLACE_IDS = 20;

type Body = {
  name?: unknown;
  googlePlaceIds?: unknown;
  limit?: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const callerRes = requireInternalCaller(req, envRes.env);
  if (!callerRes.ok) return callerRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const name = (typeof body.name === "string" ? body.name : "").trim();
  const placeIds = Array.isArray(body.googlePlaceIds)
    ? body.googlePlaceIds
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .slice(0, MAX_PLACE_IDS)
    : [];
  const limit = typeof body.limit === "number" && Number.isFinite(body.limit)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(body.limit)))
    : DEFAULT_LIMIT;

  if (name.length < 2 && placeIds.length === 0) {
    return json(
      { ok: false, error: "Give a name (2+ chars) or googlePlaceIds" },
      400,
    );
  }

  const admin = adminClient(envRes.env);

  // Both legs are independent reads — run them together.
  const [byName, byId] = await Promise.all([
    name.length >= 2
      ? admin
        .from("projects_view")
        .select(MEMO_PLACE_PUBLIC_SELECT)
        .ilike("name", `%${escapeIlike(name)}%`)
        .in("status", BROWSABLE_STATUS)
        .limit(limit)
      : Promise.resolve({ data: [], error: null }),
    placeIds.length > 0
      ? admin
        .from("projects_view")
        .select(MEMO_PLACE_PUBLIC_SELECT)
        .in("google_place_id", placeIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (byName.error) console.error("[search-places] name:", byName.error.message);
  if (byId.error) console.error("[search-places] placeIds:", byId.error.message);

  // Name hits lead (they answered the actual question); id hits fill in. Dedupe
  // on the catalog id so a place matching both modes appears once.
  const seen = new Set<string>();
  const places: MemoPlaceCard[] = [];
  for (const row of [...(byName.data ?? []), ...(byId.data ?? [])]) {
    const card = rowToMemoPlaceCard(row as unknown as Record<string, unknown>);
    if (!card.id || seen.has(card.id)) continue;
    seen.add(card.id);
    places.push(card);
  }

  return json({ ok: true, places, caller: callerRes.callerName });
});
