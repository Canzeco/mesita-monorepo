// VIP partners (MESITA-2556): the partners a VIP comes through — an agency, a
// creator deal, a venue. A partner with a place is a partner venue. This is
// the schema before any partner rate: nothing here names a rate, a discount
// or an eligibility rule (Pato's open decisions). Admin › Manage › Guests
// reads the list (admin-web-list-guests) and adds or edits one
// (admin-web-save-vip-partner); the guest's own Class sheet shows the name of
// the partner their VIP came through (consumer-web-get-profile).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const VIP_PARTNER_NAME_MAX = 80;

export type VipPartner = {
  id: string;
  name: string;
  /** The Mesita place this partner is, when it is a venue. */
  placeId: string | null;
  /** That place's display name, when it still resolves. */
  placeName: string | null;
};

export type PartnerError = { code: string; error: string; status: number };

export type PartnerBody = {
  /** Absent = a new partner. */
  id: string | null;
  name: string;
  /** undefined = leave the venue as it is; null = not a venue; a string = the
   *  Google Place ID of the Mesita place this partner is. */
  googlePlaceId: string | null | undefined;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The body of a save call, checked. The name is trimmed and its inner
 *  whitespace collapsed; the uniqueness check is the database's. */
export function readPartnerBody(
  body: unknown,
): ({ ok: true } & PartnerBody) | ({ ok: false } & PartnerError) {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  let id: string | null = null;
  if (b.id !== undefined && b.id !== null) {
    if (typeof b.id !== "string" || !UUID_RE.test(b.id.trim())) {
      return { ok: false, status: 400, code: "invalid_partner", error: "id must be a partner's id" };
    }
    id = b.id.trim().toLowerCase();
  }
  const name = typeof b.name === "string" ? b.name.replace(/\s+/g, " ").trim() : "";
  if (name === "") {
    return { ok: false, status: 400, code: "invalid_name", error: "name is required" };
  }
  if (name.length > VIP_PARTNER_NAME_MAX) {
    return {
      ok: false,
      status: 400,
      code: "name_too_long",
      error: `name is ${name.length} characters; the limit is ${VIP_PARTNER_NAME_MAX}`,
    };
  }
  let googlePlaceId: string | null | undefined = undefined;
  if ("googlePlaceId" in b) {
    const v = b.googlePlaceId;
    if (v === null || (typeof v === "string" && v.trim() === "")) {
      googlePlaceId = null;
    } else if (typeof v === "string" && /^[A-Za-z0-9_-]{10,}$/.test(v.trim())) {
      googlePlaceId = v.trim();
    } else {
      return {
        ok: false,
        status: 400,
        code: "invalid_place",
        error: "googlePlaceId must be a Google Place ID (ChIJ…) or empty",
      };
    }
  }
  return { ok: true, id, name, googlePlaceId };
}

/** Every partner, by name, with its venue's name. Throws on a failed read. */
export async function loadVipPartners(admin: SupabaseClient): Promise<VipPartner[]> {
  const { data, error } = await admin
    .from("vip_partners")
    .select("id, name, place_id")
    .order("name", { ascending: true });
  if (error) throw new Error(`vip_partners_read: ${error.message}`);
  const rows = (data ?? []) as { id: string; name: string; place_id: string | null }[];
  const placeIds = rows.map((r) => r.place_id).filter((v): v is string => !!v);
  const names = new Map<string, string>();
  if (placeIds.length > 0) {
    const places = await admin.from("profiles").select("id, name").in("id", placeIds);
    if (places.error) throw new Error(`vip_partner_places_read: ${places.error.message}`);
    for (const p of places.data ?? []) {
      if (p.id && p.name) names.set(p.id as string, p.name as string);
    }
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    placeId: r.place_id,
    placeName: r.place_id ? names.get(r.place_id) ?? null : null,
  }));
}

/** The Mesita place with this Google Place ID: its id and name, or null when
 *  Mesita has none. Throws on a failed read. */
export async function findPlaceByGoogleId(
  admin: SupabaseClient,
  googlePlaceId: string,
): Promise<{ id: string; name: string | null } | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, name")
    .eq("google_place_id", googlePlaceId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`place_read: ${error.message}`);
  return data ? { id: data.id as string, name: (data.name as string | null) ?? null } : null;
}
