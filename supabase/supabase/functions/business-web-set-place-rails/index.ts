// Supabase Edge Function — business-web-set-place-rails
//
// The OPERATOR's door onto the four acceptance INTENT BITS — the Capabilities
// tab's switches. Its twin `admin-web-set-place-rails` is the admin console's;
// both are a guard plus `_shared/place-rails.ts` (MESITA-1736).
//
// Auth: `requireEditor` on the place — the exact server-side mirror of the
// predicate that put the tab on screen. `place-view.ts` `visibleTabs()` grants
// Capabilities to every held role EXCEPT viewer, and requireEditor passes
// owner + editor (and super-admins, so the admin console's own operators are
// never locked out of the door their console does not use). A viewer who
// types the URL gets the same 403 the tab row already implies.
//
// Body: { placeId | projectId, mesita_pay?, credits?, pickup?, delivery? } —
//       booleans, at least one present.
// Response: { ok: true, rails: { mesita_pay, credits, pickup, delivery } } —
//       the post-write row, so the client reconciles from truth.
//
// Local:  supabase functions serve business-web-set-place-rails
// Deploy: supabase functions deploy business-web-set-place-rails

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireEditor,
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

  const bodyRes = await readJson<RailBody>(req);
  if (!bodyRes.ok) return bodyRes.response;

  // The place is read before the guard because the guard is place-scoped:
  // "which place?" has to be answered before "may you touch it?".
  const idRes = readRailPlaceId(bodyRes.body);
  if (!idRes.ok) return idRes.response;

  const admin = adminClient(envRes.env);
  const roleRes = await requireEditor(
    admin,
    authRes.user,
    idRes.placeId,
    "Only this place's owners and editors can change what it offers.",
  );
  if (!roleRes.ok) return roleRes.response;

  return await setPlaceRails(admin, idRes.placeId, bodyRes.body);
});
