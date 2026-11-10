// List or unlist a place (places.state active ↔ paused) — the body behind admin-web-set-place-listed (web-admin lists) and business-web-set-place-listed
// (web-business, the place page), MESITA-3104. Both doors open with
// requireAdminRequest (super_admins); the EF name is the caller.

import {
  json,
  readJson,
  readPlaceIdAlias } from "./http.ts";
import { readAdminPlace } from "./admin-place.ts";
import { writePlace } from "./place-doc.ts";
import { isPlaceListed } from "./place-state.ts";
import { recordAdminOperatorEvent } from "./admin-operator-events.ts";
import { requireAdminRequest } from "../_shared/request.ts";

/** Where an unlist lands — outside the visible set, and reversible. */
const UNLISTED_STATE = "paused";
/** Where a re-list lands. */
const LISTED_STATE = "active";

type Body = { placeId?: unknown; projectId?: unknown; listed?: unknown };

export async function handleSetPlaceListed(req: Request, source: string): Promise<Response> {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const placeId = readPlaceIdAlias(body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);
  if (typeof body.listed !== "boolean") {
    return json({ ok: false, error: "listed must be a boolean" }, 400);
  }
  const listed = body.listed;

  const { data: current, error: readCurrent } = await admin
    .from("places")
    .select("state")
    .eq("id", placeId)
    .maybeSingle();
  if (readCurrent) {
    return json({ ok: false, error: `state_read: ${readCurrent.message}` }, 500);
  }
  if (!current) return json({ ok: false, error: "Place not found" }, 404);

  const currentState = (current as { state: string | null }).state ?? "";
  const alreadyListed = isPlaceListed(currentState);

  // Already where the caller wants it — report success without a write, so a
  // double-click or a stale toggle is a no-op.
  if (alreadyListed === listed) {
    const readBack = await readAdminPlace(admin, placeId);
    if (!readBack.ok) return readBack.response;
    const place = readBack.place;
    return json({ ok: true, listed, state: currentState, place });
  }

  const nextState = listed ? LISTED_STATE : UNLISTED_STATE;
  const updRes = await writePlace(admin, {
    table: "places",
    mode: "update",
    id: placeId,
    patch: { state: nextState },
    select: "id",
    selectMode: "maybeSingle",
  });
  if (!updRes.ok) {
    return json({ ok: false, error: `state_update: ${updRes.error}` }, 500);
  }
  if (!updRes.row) return json({ ok: false, error: "Place not found" }, 404);

  console.log(
    JSON.stringify({
      event: "place_listing_changed",
      place: placeId,
      from: currentState,
      to: nextState,
      actor: user.email ?? user.id,
    }),
  );

  await recordAdminOperatorEvent(admin, {
    verb: "edit",
    outcome: "succeeded",
    placeId,
    actorUserId: user.id,
    source: source,
    detail: { action: listed ? "list" : "unlist", from: currentState, to: nextState },
  });

  const readBack = await readAdminPlace(admin, placeId);
  if (!readBack.ok) return readBack.response;
  const place = readBack.place;

  return json({ ok: true, listed, state: nextState, place });
}
