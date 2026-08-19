// Supabase Edge Function — consumer-web-list-favorites (product caller)
//
// Authenticated read of the caller's bookmarks. Returns favorites
// joined with the place summary the saved card needs (name, slug,
// hero photo, category, price level, distance computed client-side).
//
// Deploy: supabase functions deploy consumer-web-list-favorites

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { clampIntRange, corsPreflight, json, rejectUnlessMethods, readJsonOr } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { attachPlaces } from "../_shared/reservation-places.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const _methodGuard = rejectUnlessMethods(req, "GET", "POST");
  if (_methodGuard) return _methodGuard;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const consumerId = authRes.user.id;

  let limit = DEFAULT_LIMIT;
  if (req.method === "POST") {
    const body = await readJsonOr<{ limit?: number }>(req, {});
    if (typeof body.limit === "number") {
      limit = clampIntRange(body.limit, 1, MAX_LIMIT);
    }
  }

  const admin = adminClient(envRes.env);

  const { data, error } = await admin
    .from("favorites")
    .select(
      "id, created_at, project_id",
    )
    .eq("consumer_id", consumerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, favorites: await attachPlaces(admin, data ?? []) });
});
