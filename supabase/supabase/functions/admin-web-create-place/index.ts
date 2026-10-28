// Supabase Edge Function — admin-web-create-place (admin caller / LIVE admin create path)
//
// The admin-app equivalent of business-web-create-place (retired,
// MESITA-2090): an admin operator
// passes a Google Places `placeId` and gets back the ugly profile (Create
// 1–4, content_state ready, enriched_at null). Enricher is NOT queued —
// Enrich / Create+Enrich is a second call; guests vote on the Enrich tab.
// Core: createMinimalPlace (_shared/create-place.ts), which never seeds Enricher.
//
// `onOpen: true` marks a create that an OPEN caused (a Google-only row's
// name on Single Place › Find, MESITA-2298): Configurations › Creation ›
// "Create the profile on open · admin app" gates it with 403
// `create_on_open_off`. The explicit Create button sends no flag and is
// never gated.
//
// Roles are simple now: admins create from the admin app via THIS function.
// business-web-create-place retired with web-business (MESITA-2090).
//
// Gating: operator JWT → the admin allowlist (requireSuperAdmin checks the
// public.super_admins table — that table IS the admin allowlist; this is the
// same gate every other admin-* EF uses).
//
// Difference vs the retired business-web-create-place: NO managers upsert — an
// admin creates an UNOWNED listing. Ownership landed only when a business
// claimed it and admin-web-decide-verification approved, and both doors were
// retired in MESITA-2090.
//
// Local:  supabase functions serve admin-web-create-place
// Deploy: supabase functions deploy admin-web-create-place

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv, requireSuperAdmin } from "../_shared/auth.ts";
import { createMinimalPlace } from "../_shared/create-place.ts";
import { normalizeEnrichmentConfig } from "../_shared/enrichment-config.ts";
import { readAppConfig } from "../_shared/write-config.ts";
import { recordAdminOperatorEvent } from "../_shared/admin-operator-events.ts";

type Body = { placeId?: string; onOpen?: boolean };

serveJson("admin-web-create-place", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const env = envRes.env;

  // Authenticate the admin operator against the admin allowlist.
  const authRes = await getAuthedUser(req, env);
  if (!authRes.ok) return authRes.response;
  const admin = adminClient(env);
  const guard = await requireSuperAdmin(admin, authRes.user, "Only admins can create places.");
  if (!guard.ok) return guard.response;

  // Parse input.
  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = (bodyRes.body.placeId ?? "").toString().trim();
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  if (bodyRes.body.onOpen === true) {
    const creation = await readAppConfig(
      admin,
      "enrichment_config",
      "enrichment_config_read",
    );
    if (!creation.ok) return creation.response;
    const createOnOpen = normalizeEnrichmentConfig(
      creation.row?.enrichment_config,
    ).enrichCreateOnOpenAdmin;
    if (!createOnOpen) {
      await recordAdminOperatorEvent(admin, {
        verb: "create",
        outcome: "failed",
        actorUserId: authRes.user.id,
        source: "admin-web-create-place",
        detail: { code: "create_on_open_off", googlePlaceId: placeId },
      });
      return json(
        {
          ok: false,
          code: "create_on_open_off",
          error: "Create on open is off for the admin app (Configurations › Creation).",
        },
        403,
      );
    }
  }

  const created = await createMinimalPlace({
    admin,
    callerName: "admin-web-create-place",
    googlePlaceId: placeId,
  });
  if (!created.ok) {
    await recordAdminOperatorEvent(admin, {
      verb: "create",
      outcome: "failed",
      actorUserId: authRes.user.id,
      source: "admin-web-create-place",
      detail: {
        code: (created.body as { code?: string }).code ?? "create_failed",
        googlePlaceId: placeId,
      },
    });
    return json(created.body, created.status);
  }

  await recordAdminOperatorEvent(admin, {
    verb: "create",
    outcome: "succeeded",
    placeId: created.place.id,
    actorUserId: authRes.user.id,
    source: "admin-web-create-place",
    detail: { googlePlaceId: placeId },
  });

  // `place` is the legacy alias for pre-rename admin-web builds.
  return json(
    { ok: true, place: created.place, enrichment: created.enrichment },
    201,
  );
});
