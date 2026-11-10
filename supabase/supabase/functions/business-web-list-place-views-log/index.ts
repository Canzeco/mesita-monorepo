// Supabase Edge Function — business-web-list-place-views-log
//
// MESITA-3213: Business › Views, the log of who viewed, liked and shared this
// place, newest first, a page at a time. Who is named is the SQL's call
// (place_views_log, Social's rule). The handle is never masked here: masking is a
// rule between guests (MESITA-2594), and the owner is not one. The member id
// stops at this function.
//
// Body: { place_id: uuid, before?: ISO timestamp }
// Response: { ok: true,
//             events: [{ kind: "viewed" | "saved" | "shared", at,
//                        person: { name, avatarUrl, handle, followers, guestClass, instagram } }],
//             next: ISO timestamp | null }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { type ActivityRow, toPerson } from "../_shared/place-activity.ts";

const PAGE = 30;

serveJson("business-web-list-place-views-log", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, before } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (before !== undefined && (typeof before !== "string" || Number.isNaN(Date.parse(before)))) {
    return json({ ok: false, error: "before must be a timestamp" }, 400);
  }

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  const { data, error } = await admin.rpc("place_views_log", {
    p_place_id: placeId,
    p_before: typeof before === "string" ? before : null,
    p_limit: PAGE + 1,
  });
  if (error) return json({ ok: false, error: `place_views_log: ${error.message}` }, 500);

  const rows = (data ?? []) as ActivityRow[];
  const page = rows.slice(0, PAGE);
  const events = page.map((row) => {
    const { name, avatarUrl, handle, followers, guestClass, instagram } = toPerson(row, user.id);
    return {
      kind: row.kind,
      at: row.created_at,
      person: { name, avatarUrl, handle, followers, guestClass, instagram },
    };
  });
  return json({ ok: true, events, next: rows.length > PAGE ? page[page.length - 1].created_at : null });
});
