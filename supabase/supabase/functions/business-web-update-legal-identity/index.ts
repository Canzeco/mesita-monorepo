// Supabase Edge Function — business-web-update-legal-identity
//
// Owner-only write of a PLACE's legal identity: legal name and RFC.
//
// These are deliberately NOT asked when a place is claimed (a place with
// neither can still be run) — they become required the day it partners or
// gets paid, and this endpoint is where they land.
//
// IT USED TO BE business-web-update-organization (MESITA-1892). `legal_name`
// and `rfc` hung off the organization, on the theory that the merchant was
// the container and the place was one of its addresses. With the organization
// layer gone the merchant IS the place: `places.legal_name`, `places.rfc`,
// and the partial unique index `places_rfc_unique` now says one RFC is one
// place rather than one organization. The endpoint is renamed to say what it
// writes, because "update-organization" would now name a thing that does not
// exist.
//
// Auth: requireOwner on the place — the same rank the org owner used to hold,
// now proven against the only grant there is (place_members).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { requireOwner } from "../_shared/auth-membership.ts";
import {
  isDuplicateRfcError,
  readRfc,
  RFC_SHAPE_ERROR,
  RFC_TAKEN_ERROR,
} from "../_shared/place-rfc.ts";

type Body = {
  placeId?: string;
  projectId?: string;
  legalName?: string | null;
  rfc?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const placeId = readPlaceIdAlias(body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const legalName = typeof body.legalName === "string"
    ? body.legalName.trim() || null
    : null;
  if (legalName && legalName.length > 200) {
    return json({ ok: false, error: "legal name is too long" }, 400);
  }
  // Shape, not just length (MESITA-1880). The length cap this replaces let
  // anything 20 chars or under through, and `rfcIfValid` then dropped a
  // malformed value on the floor at Connect prefill — so the owner saved an
  // RFC, saw it stored, and Stripe never received it. Now it is refused here.
  const rfcRead = readRfc(body.rfc);
  if (!rfcRead.ok) {
    return json({ ok: false, code: "rfc_shape", error: RFC_SHAPE_ERROR }, 400);
  }
  const rfc = rfcRead.rfc;

  const admin = adminClient(envRes.env);
  const ownerRes = await requireOwner(admin, authRes.user, placeId);
  if (!ownerRes.ok) return ownerRes.response;

  const { data: place, error: updErr } = await admin
    .from("places")
    .update({ legal_name: legalName, rfc })
    .eq("id", placeId)
    .select("id, legal_name, rfc, currency")
    .single();
  if (updErr || !place) {
    // Narrowed by constraint name inside `isDuplicateRfcError`: `places`
    // carries several other unique indexes, and turning every 23505 into
    // "RFC taken" would lie about them.
    if (isDuplicateRfcError(updErr)) {
      return json({ ok: false, code: "rfc_taken", error: RFC_TAKEN_ERROR }, 409);
    }
    return json({ ok: false, error: updErr?.message ?? "Update failed" }, 500);
  }

  // `name` is not returned: it is a generated column on `place_profiles`
  // (mesita_name → google_name), not a column this endpoint can write, and
  // the organization's editable `name` it used to echo is gone.
  return json({
    ok: true,
    place: {
      id: place.id,
      legalName: place.legal_name,
      rfc: place.rfc,
      currency: place.currency,
    },
  });
});
