// Supabase Edge Function — admin-web-set-place-rails
//
// The one writer for the four acceptance INTENT BITS (Pato gates
// 2026-08-29): places.mesita_pay_enabled · yums_enabled ·
// pickup_orders_enabled · delivery_orders_enabled. These are the Partner
// tab's rail toggles — the operator's "this place offers X", summed by the
// Promotion score (their reader). Each rail's ENGINE still gates the rail
// itself: Mesita Pay ANDs with visits_config.payCard + Stripe capability,
// Yums with visits_config.payYums, orders with the (unbuilt) order rail — a
// toggle here never turns an engine on.
//
// Writes `table: "places"` through the place-doc door, NEVER profiles: the
// profiles_update trigger predates these columns and silently drops them
// (validateProfilePatch refuses them for the same reason).
//
// Body: { placeId | projectId, mesita_pay?, yums?, pickup?, delivery? } —
//       booleans, at least one present.
// Response: { ok: true, rails: { mesita_pay, yums, pickup, delivery } } —
//       the post-write row, so the client reconciles from truth.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { type PlacePatch, writePlace } from "../_shared/place-doc.ts";

// Body key → places column. The closed set IS the contract: anything else in
// the body is ignored, and an empty intersection is a 400.
const RAIL_COLUMNS = {
  mesita_pay: "mesita_pay_enabled",
  yums: "yums_enabled",
  pickup: "pickup_orders_enabled",
  delivery: "delivery_orders_enabled",
} as const;

type RailKey = keyof typeof RAIL_COLUMNS;

type Body = { placeId?: unknown; projectId?: unknown } & {
  [K in RailKey]?: unknown;
};

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

  const patch: Record<string, boolean> = {};
  for (const key of Object.keys(RAIL_COLUMNS) as RailKey[]) {
    if (!(key in body)) continue;
    const value = body[key];
    if (typeof value !== "boolean") {
      return json({ ok: false, error: `${key} must be a boolean` }, 400);
    }
    patch[RAIL_COLUMNS[key]] = value;
  }
  if (Object.keys(patch).length === 0) {
    return json(
      {
        ok: false,
        error: "Nothing to set — pass at least one of mesita_pay, yums, pickup, delivery.",
      },
      400,
    );
  }

  const write = await writePlace(admin, {
    table: "places",
    mode: "update",
    id: placeId,
    patch: patch as PlacePatch,
    select:
      "mesita_pay_enabled, yums_enabled, pickup_orders_enabled, delivery_orders_enabled",
    selectMode: "maybeSingle",
  });
  if (!write.ok) return json({ ok: false, error: write.error }, 500);
  if (!write.row) return json({ ok: false, error: "Place not found" }, 404);

  return json({
    ok: true,
    rails: {
      mesita_pay: write.row.mesita_pay_enabled === true,
      yums: write.row.yums_enabled === true,
      pickup: write.row.pickup_orders_enabled === true,
      delivery: write.row.delivery_orders_enabled === true,
    },
  });
});
