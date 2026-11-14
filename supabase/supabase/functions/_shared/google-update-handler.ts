// Update for one place (MESITA-2737): refresh its Google factuals, never the
// gallery (MESITA-3931). Respects field pins; does not enqueue Enrich; audited via source_sync and an
// operator event. Super-admin only. The body of admin-web-update-place-google
// and, from the Business app's Admin page, business-web-update-place-google
// (MESITA-3157), as enrich-place-handler.ts is for Enrich.

import { json, readJson, readPlaceIdAlias } from "./http.ts";
import { runGooglePlaceUpdate } from "./admin-google-place-update.ts";
import { recordAdminOperatorEvent } from "./admin-operator-events.ts";
import { requireAdminRequest } from "../_shared/request.ts";

type Body = { placeId?: string; projectId?: string };

export async function handleGooglePlaceUpdate(req: Request, source: string): Promise<Response> {
  const ctx = await requireAdminRequest(req, "Only admins can update Google data.");
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = readPlaceIdAlias(bodyRes.body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const result = await runGooglePlaceUpdate(admin, placeId, {
    supabaseUrl: env.url,
  });
  if (!result.ok) {
    await recordAdminOperatorEvent(admin, {
      verb: "update",
      outcome: "failed",
      placeId,
      actorUserId: user.id,
      source,
      detail: { error: result.error, code: result.code ?? null },
    });
    return json(
      { ok: false, error: result.error, ...(result.code ? { code: result.code } : {}) },
      result.status,
    );
  }

  await recordAdminOperatorEvent(admin, {
    verb: "update",
    outcome: "succeeded",
    placeId,
    actorUserId: user.id,
    source,
    detail: { pinned: result.pinned },
  });

  return json({
    ok: true,
    placeId,
    updatedAt: result.updatedAt,
    pinned: result.pinned,
    businessStatus: result.businessStatus,
  });
}
