// Supabase Edge Function — admin-web-set-place-selected
//
// The ONLY door onto places.selected — Mesita Selected, the operator's own
// mark (MESITA-2707). Pato, 2026-10-22: "Selected must be an independent tag
// from Popularity. selected is the manual thing. and its also independent of
// enrichment."
//
// Until MESITA-2707 Selected was derived (Enriched, a ready profile, not
// Disabled) and nothing in the product could set it. Now it is a column the
// operator flips from Single Place › Admin › Profile States, and every
// reader reads the column: the Area pool's `source` (Home and the Map),
// Chat's Selected-only read, the Search pins (red) and the carousel tag, the
// admin State box and the Single Place table. Enriched is untouched: a place
// can be Selected before any Enrich run, or Enriched and not Selected.
//
// The Area score multiplies a Selected place by the operator's Selected
// factor (MESITA-2717, after MESITA-2703 had retired the old one) and no RLS
// policy reads it, so the toggle is reversible and needs no confirm.
//
// Body:     { placeId | projectId, selected: boolean }
// Response: { ok: true, selected, place }
//           `place` is the same AdminPlace shape admin-web-update-place
//           returns, so the console reconciles from one call.
// Auth:     caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { PLACE_PROFILE_COLUMNS } from "../_shared/place-columns.ts";
import { writePlace } from "../_shared/place-doc.ts";

type Body = { placeId?: unknown; projectId?: unknown; selected?: unknown };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const placeId = readPlaceIdAlias(body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);
  if (typeof body.selected !== "boolean") {
    return json({ ok: false, error: "selected must be a boolean" }, 400);
  }
  const selected = body.selected;

  const { data: current, error: readCurrent } = await admin
    .from("places")
    .select("selected")
    .eq("id", placeId)
    .maybeSingle();
  if (readCurrent) {
    return json({ ok: false, error: `selected_read: ${readCurrent.message}` }, 500);
  }
  if (!current) return json({ ok: false, error: "Place not found" }, 404);
  const already = (current as { selected: boolean | null }).selected === true;

  // Already where the caller wants it — report success without a write, so a
  // double-click or a stale toggle is a no-op.
  if (already !== selected) {
    const updRes = await writePlace(admin, {
      table: "places",
      mode: "update",
      id: placeId,
      patch: { selected },
      select: "id",
      selectMode: "maybeSingle",
    });
    if (!updRes.ok) {
      return json({ ok: false, error: `selected_update: ${updRes.error}` }, 500);
    }
    if (!updRes.row) return json({ ok: false, error: "Place not found" }, 404);

    console.log(
      JSON.stringify({
        event: "place_selected_changed",
        place: placeId,
        from: already,
        to: selected,
        actor: authRes.user.email ?? authRes.user.id,
      }),
    );
  }

  const { data: place, error: readError } = await admin
    .from("profiles")
    .select(PLACE_PROFILE_COLUMNS)
    .eq("id", placeId)
    .single();
  if (readError) {
    return json({ ok: false, error: `place_read: ${readError.message}` }, 500);
  }

  return json({ ok: true, selected, place });
});
