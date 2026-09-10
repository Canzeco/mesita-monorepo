// Supabase Edge Function — admin-web-set-place-rails
//
// The ADMIN door onto the four acceptance INTENT BITS. Its twin
// `business-web-set-place-rails` is the operator's door; both are a guard
// plus `_shared/place-rails.ts`, which holds the rail contract and the write
// so the two consoles can never disagree about what a rail is (MESITA-1736).
//
// Body: { placeId | projectId, mesita_pay?, credits?, pickup?, delivery? } —
//       booleans, at least one present.
// Response: { ok: true, rails: { mesita_pay, credits, pickup, delivery } } —
//       the post-write row, so the client reconciles from truth.
//
// Auth: caller's JWT email must be in public.super_admins.
//
// NO CALLER TODAY. web-business was its only one and now uses its own door;
// web-admin never wrote these bits — it reads them (admin-web-search-places
// projections, the State box) and has no rail switch. Kept rather than
// deleted because MESITA-1736 scoped itself to unbreaking the operator, and
// retiring a deployed door is its own decision with its own cloud step.
// Whoever picks that up: the body is shared, so deleting this file and its
// config.toml stanza costs nothing here — the work is the cloud delete.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { type RailBody, readRailPlaceId, setPlaceRails } from "../_shared/place-rails.ts";

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

  const bodyRes = await readJson<RailBody>(req);
  if (!bodyRes.ok) return bodyRes.response;

  const idRes = readRailPlaceId(bodyRes.body);
  if (!idRes.ok) return idRes.response;

  return await setPlaceRails(admin, idRes.placeId, bodyRes.body);
});
