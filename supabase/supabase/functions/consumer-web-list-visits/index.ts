// Supabase Edge Function — consumer-web-list-visits
//
// MESITA-3264: Me › Visits (Pato: "there we are going to save the history of
// visits"). This guest's own closed visits, newest first, a page at a time. A voided
// visit does not count. What was paid is what the server worked out at the close;
// no money moves through Mesita.
//
// Body: { before?: ISO time }
// Response: { ok: true, visits: [{ id, place_id, place_name, photo, bill_cents,
//   discount_cents, total_cents, currency, created_at }], next: ISO time | null }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { readSince } from "../_shared/place-visits.ts";

const PAGE = 30;

serveJson("consumer-web-list-visits", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Record<string, unknown>>(req, {});
  const before = readSince(body.before);

  const admin = adminClient(envRes.env);
  let query = admin
    .from("place_visits")
    .select("id, place_id, bill_cents, discount_cents, total_cents, currency, created_at")
    .eq("consumer_id", authRes.user.id)
    .is("voided_at", null)
    .order("created_at", { ascending: false })
    .limit(PAGE + 1);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) return json({ ok: false, error: `place_visits: ${error.message}` }, 500);

  const rows = data ?? [];
  const page = rows.slice(0, PAGE);
  const placeIds = [...new Set(page.map((v) => v.place_id))];
  const places = new Map<string, { name: string | null; photos: string[] | null }>();
  if (placeIds.length > 0) {
    const { data: found, error: placesError } = await admin.from("profiles").select("id, name, photos").in("id", placeIds);
    if (placesError) return json({ ok: false, error: `profiles: ${placesError.message}` }, 500);
    for (const p of found ?? []) places.set(p.id, p);
  }

  return json({
    ok: true,
    visits: page.map((v) => {
      const place = places.get(v.place_id);
      return { ...v, place_name: place?.name ?? null, photo: place?.photos?.[0] ?? null };
    }),
    next: rows.length > PAGE ? page[page.length - 1].created_at : null,
  });
});
