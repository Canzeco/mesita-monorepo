// Supabase Edge Function — admin-web-save-vip-partner
//
// Manage › Guests (MESITA-2556). Adds a VIP partner (an agency, a creator
// deal, a venue) or renames one, and marks whether it is a Mesita venue by
// the place's Google Place ID. Names no rate: partner rates are not decided.
// Super-admin only. Returns the saved partner and the whole list.
//
// Body: { id?, name, googlePlaceId? } — no id adds; googlePlaceId absent
// leaves the venue as it is, null or "" makes it not a venue.
//
// Errors are { ok: false, code, error } with a stable code and the fix:
//   400 invalid_partner · invalid_name · name_too_long · invalid_place
//   404 partner_not_found · place_not_found
//   409 name_taken · place_taken · 500 save_failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import {
  findPlaceByGoogleId,
  loadVipPartners,
  readPartnerBody,
} from "../_shared/vip-partners.ts";

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

  const bodyRes = await readJson<unknown>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readPartnerBody(bodyRes.body);
  if (!parsed.ok) {
    return json({ ok: false, code: parsed.code, error: parsed.error }, parsed.status);
  }

  const row: Record<string, unknown> = { name: parsed.name };
  if (parsed.googlePlaceId === null) {
    row.place_id = null;
  } else if (parsed.googlePlaceId !== undefined) {
    let place;
    try {
      place = await findPlaceByGoogleId(admin, parsed.googlePlaceId);
    } catch (err) {
      return json({ ok: false, code: "save_failed", error: (err as Error).message }, 500);
    }
    if (!place) {
      return json({
        ok: false,
        code: "place_not_found",
        error: "No Mesita place has that Google Place ID. Create the place first, or leave it empty.",
      }, 404);
    }
    row.place_id = place.id;
  }

  const write = parsed.id
    ? admin.from("vip_partners").update(row).eq("id", parsed.id).select("id")
    : admin.from("vip_partners").insert({ ...row, created_by: authRes.user.id }).select("id");
  const { data, error } = await write;
  if (error) {
    if (error.code === "23505") {
      const placeClash = /place_id/.test(`${error.message} ${error.details ?? ""}`);
      return json(
        placeClash
          ? { ok: false, code: "place_taken", error: "That place is already another partner." }
          : { ok: false, code: "name_taken", error: `A partner named “${parsed.name}” already exists.` },
        409,
      );
    }
    return json({ ok: false, code: "save_failed", error: `save_failed: ${error.message}` }, 500);
  }
  const savedId = (data ?? [])[0]?.id as string | undefined;
  if (!savedId) {
    return json({ ok: false, code: "partner_not_found", error: "No such partner" }, 404);
  }

  console.log("vip_partner_saved", JSON.stringify({
    id: savedId,
    created: !parsed.id,
    venueChanged: parsed.googlePlaceId !== undefined,
  }));

  let partners;
  try {
    partners = await loadVipPartners(admin);
  } catch (err) {
    return json({ ok: false, code: "save_failed", error: `saved, but ${(err as Error).message}` }, 500);
  }
  return json({
    ok: true,
    partner: partners.find((p) => p.id === savedId) ?? null,
    partners,
  });
});
