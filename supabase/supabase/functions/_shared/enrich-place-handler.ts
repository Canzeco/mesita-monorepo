// Start the full Enrich for one or more places — the body behind admin-web-enrich-place (web-admin lists) and business-web-enrich-place
// (web-business, the place page), MESITA-3104. Both doors open with
// requireAdminRequest (super_admins); the EF name is the caller.

import {
  json,
  readJson,
  readPlaceIdAlias } from "./http.ts";
import { startEnrichment } from "./enrich-start.ts";
import { recordAdminOperatorEvent } from "./admin-operator-events.ts";
import { requireAdminRequest } from "../_shared/request.ts";

type Body = {
  projectId?: string;
  placeId?: string;
  placeIds?: string[];
  // There is one Enrich (MESITA-2799). An older admin tab may still send
  // `overwrite` or `depth`; neither is read.
};

export async function handleEnrichPlace(req: Request, source: string): Promise<Response> {
  const ctx = await requireAdminRequest(req, "Only admins can re-enrich places.");
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const listed = Array.isArray(bodyRes.body.placeIds)
    ? bodyRes.body.placeIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    : [];
  const placeId = readPlaceIdAlias(bodyRes.body);
  const placeIds = listed.length > 0 ? listed : placeId ? [placeId] : [];

  const started = await startEnrichment(admin, { placeIds });
  if (!started.ok) {
    await recordAdminOperatorEvent(admin, {
      verb: "enrich",
      outcome: "failed",
      actorUserId: user.id,
      source: source,
      detail: { count: placeIds.length, error: started.error },
    });
    return json({ ok: false, error: started.error }, started.status);
  }
  await recordAdminOperatorEvent(admin, {
    verb: "enrich",
    outcome: "succeeded",
    placeId: started.started.length === 1 ? started.started[0] : null,
    actorUserId: user.id,
    source: source,
    detail: { count: started.started.length, skipped: started.skipped.length },
  });
  return json({ ok: true, enrichmentTriggered: true, task: started.task, skipped: started.skipped });
}
