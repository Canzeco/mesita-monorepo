// Supabase Edge Function — consumer-web-list-place-likes
//
// The place profile's line under the title ("Perdón and 3 others liked this",
// likes only since MESITA-2594), up to five faces, and the guest's own saved
// for the action row. Its own name since MESITA-3042 (it was
// consumer-web-list-activity's "place" scope).
//
// ANONYMOUS (MESITA-4246): no session reads the same line with every
// person reduced to Class (anonymousPerson); `me.saved` is
// false. A broken session is a 401.
//
// Body: { place_id }
//   → { viewer, line, people, total, me: { saved } }
//
// Who appears is the SQL's call (place_activity_people: the instagram level
// alone, MESITA-4850). Handles leave masked unless the viewer shows their
// own (MESITA-2594, seesHandles).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withInstagramBadges } from "../_shared/instagram-badge.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { consumerOrAnonymousRequest } from "../_shared/request.ts";
import { type ActivityRow, anonymousPerson, isMesitaPlaceId, socialLine, toPerson } from "../_shared/place-activity.ts";
import { readViewer } from "../_shared/place-activity-read.ts";

const LINE_FACES = 5;

type Body = { place_id?: string };

serveJson("consumer-web-list-place-likes", async (req) => {
  const ctx = await consumerOrAnonymousRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isMesitaPlaceId(placeId)) {
    return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  }

  const [peopleRes, mineRes, seen] = await Promise.all([
    admin.rpc("place_activity_people", { p_place_id: placeId, p_limit: LINE_FACES }),
    user
      ? admin
        .from("place_activity")
        .select("kind")
        .eq("consumer_id", user.id)
        .eq("place_id", placeId)
      : Promise.resolve({ data: [], error: null }),
    user ? readViewer(admin, user.id) : Promise.resolve({ ok: true as const, blocked: null, canSee: false }),
  ]);
  if (!seen.ok) return json({ ok: false, error: seen.error }, 500);
  const canSee = seen.canSee;
  if (peopleRes.error) return json({ ok: false, error: `people: ${peopleRes.error.message}` }, 500);
  if (mineRes.error) return json({ ok: false, error: `mine: ${mineRes.error.message}` }, 500);
  // MESITA-4714: the yellow badge (members only; an anonymous visitor sees none).
  // A private member sees nobody (MESITA-4854); their own like stays.
  const rawRows = seen.blocked ? [] : (peopleRes.data ?? []) as ActivityRow[];
  const rows = user ? await withInstagramBadges(admin, rawRows, paymentsLivemode()) : rawRows;
  const people = rows.map((r) => (user ? toPerson(r, user.id, canSee) : anonymousPerson(r)));
  const total = rows.length > 0 ? Number(rows[0].total ?? rows.length) : 0;
  const mine = new Set(((mineRes.data ?? []) as { kind: string }[]).map((r) => r.kind));
  return json({
    ok: true,
    viewer: user ? "member" : "anonymous",
    line: socialLine(people[0] ?? null, total),
    people,
    total,
    me: { saved: mine.has("saved") },
  });
});
