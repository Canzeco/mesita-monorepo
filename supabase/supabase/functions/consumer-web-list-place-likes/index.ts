// Supabase Edge Function — consumer-web-list-place-likes
//
// The place profile's line under the title ("Perdón and 3 others liked this",
// likes only since MESITA-2594), up to five faces, and the guest's own saved
// for the action row. Its own name since MESITA-3042 (it was
// consumer-web-list-activity's "place" scope).
//
// Body: { place_id }
//   → { line, people, total, me: { saved } }
//
// Who appears is the SQL's call (place_activity_people over
// place_activity_visible). Handles leave masked unless the viewer shows their
// own (MESITA-2594, seesHandles).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { type ActivityRow, isMesitaPlaceId, socialLine, toPerson } from "../_shared/place-activity.ts";
import { viewerSeesHandles } from "../_shared/place-activity-read.ts";

const LINE_FACES = 5;

type Body = { place_id?: string };

serveJson("consumer-web-list-place-likes", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const viewerId = authRes.user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isMesitaPlaceId(placeId)) {
    return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  }

  const admin = adminClient(envRes.env);
  const [peopleRes, mineRes, canSee] = await Promise.all([
    admin.rpc("place_activity_people", { p_place_id: placeId, p_limit: LINE_FACES }),
    admin
      .from("place_activity")
      .select("kind")
      .eq("consumer_id", viewerId)
      .eq("place_id", placeId),
    viewerSeesHandles(admin, viewerId),
  ]);
  if (peopleRes.error) return json({ ok: false, error: `people: ${peopleRes.error.message}` }, 500);
  if (mineRes.error) return json({ ok: false, error: `mine: ${mineRes.error.message}` }, 500);
  const rows = (peopleRes.data ?? []) as ActivityRow[];
  const people = rows.map((r) => toPerson(r, viewerId, canSee));
  const total = rows.length > 0 ? Number(rows[0].total ?? rows.length) : 0;
  const mine = new Set(((mineRes.data ?? []) as { kind: string }[]).map((r) => r.kind));
  return json({
    ok: true,
    line: socialLine(people[0] ?? null, total),
    people,
    total,
    me: { saved: mine.has("saved") },
  });
});
