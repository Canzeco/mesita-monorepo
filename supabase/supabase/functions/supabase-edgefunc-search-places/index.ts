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
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { escapeIlike } from "../_shared/google-places.ts";
import {
  MEMO_PLACE_PUBLIC_SELECT,
  type MemoPlaceCard,
  rowToMemoPlaceCard,
} from "../_shared/memo-place-card.ts";
import { displayName } from "../_shared/place-display-name.ts";

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
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

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
  // Name leg matches Mesita name OR google_name (MESITA-917); one row per id.
  const pattern = `%${escapeIlike(name)}%`;
  const [byName, byId] = await Promise.all([
    name.length >= 2
      ? admin
        .from("projects_view")
        .select(MEMO_PLACE_PUBLIC_SELECT)
        .or(`name.ilike."${pattern}",google_name.ilike."${pattern}"`)
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

  // Prefer Mesita-name hits, then google-only, then id hits. Dedupe on catalog id.
  const qLower = name.toLowerCase();
  const nameRows = [...(byName.data ?? [])] as Record<string, unknown>[];
  nameRows.sort((a, b) => {
    const aMesita = typeof a.name === "string" &&
      a.name.toLowerCase().includes(qLower);
    const bMesita = typeof b.name === "string" &&
      b.name.toLowerCase().includes(qLower);
    if (aMesita !== bMesita) return aMesita ? -1 : 1;
    return 0;
  });

  const seen = new Set<string>();
  const places: MemoPlaceCard[] = [];
  for (const row of [...nameRows, ...(byId.data ?? [])]) {
    const raw = row as unknown as Record<string, unknown>;
    const card = rowToMemoPlaceCard({
      ...raw,
      // Card label = Mesita priority (empty Mesita name → google_name).
      name: displayName({
        name: (raw.name as string | null) ?? null,
        google_name: (raw.google_name as string | null) ?? null,
      }),
    });
    if (!card.id || seen.has(card.id)) continue;
    seen.add(card.id);
    places.push(card);
  }

  return json({ ok: true, places, caller: callerRes.callerName });
});
