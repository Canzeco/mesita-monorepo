// Who may open a place in the Business app (MESITA-3103). The server answers
// it; hiding a link is never the gate.
//
//   superadmin  the caller's email is in public.super_admins (any place)
//   owner       the caller has a live place_managers row for this place
//               (revoked_at null, expires_at in the future)
//
// Anyone else gets 404, never 403: whether a place exists, or who runs it,
// is not something a stranger learns from this door.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { AuthedUser } from "./auth.ts";
import { checkSuperAdmin } from "./auth-super-admin.ts";
import { json } from "./http.ts";

export type PlaceRole = "superadmin" | "owner";

export type ManagerRow = {
  id: string;
  place_id: string;
  consumer_id: string;
  method: "phone_match" | "phone_code" | "review";
  verified_at: string;
  expires_at: string;
  revoked_at: string | null;
};

export const MANAGER_COLUMNS = "id, place_id, consumer_id, method, verified_at, expires_at, revoked_at";

/** A row grants the place only while it is not revoked and not expired. Pure. */
export function isLiveManager(
  row: Pick<ManagerRow, "revoked_at" | "expires_at"> | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!row || row.revoked_at) return false;
  const ends = Date.parse(row.expires_at);
  return Number.isFinite(ends) && ends > now;
}

/** The caller's unrevoked row for this place (live or expired), or null. */
export async function managerRow(
  admin: SupabaseClient,
  placeId: string,
  consumerId: string,
): Promise<ManagerRow | null> {
  const { data, error } = await admin
    .from("place_managers")
    .select(MANAGER_COLUMNS)
    .eq("place_id", placeId)
    .eq("consumer_id", consumerId)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw new Error(`place_managers: ${error.message}`);
  return (data as ManagerRow | null) ?? null;
}

export type PlaceAccess = { role: PlaceRole; manager: ManagerRow | null };

/** The role this caller has on this place, or null. Throws on a failed read. */
export async function placeAccess(
  admin: SupabaseClient,
  user: AuthedUser,
  placeId: string,
): Promise<PlaceAccess | null> {
  if (await checkSuperAdmin(admin, user)) return { role: "superadmin", manager: null };
  const row = await managerRow(admin, placeId, user.id);
  return isLiveManager(row) ? { role: "owner", manager: row } : null;
}

/** placeAccess as an EF gate: the access, or the Response to return. */
export async function requirePlaceAccess(
  admin: SupabaseClient,
  user: AuthedUser,
  placeId: string,
): Promise<PlaceAccess | Response> {
  try {
    const access = await placeAccess(admin, user, placeId);
    if (!access) return json({ ok: false, code: "not_found", error: "Place not found" }, 404);
    return access;
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : "Access check failed" }, 500);
  }
}

export type OwnerView = {
  id: string;
  consumer_id: string;
  name: string | null;
  phone: string | null;
  instagram_handle: string | null;
  member_number: string | null;
  method: ManagerRow["method"];
  verified_at: string;
  expires_at: string;
  live: boolean;
};

export type PendingRequestView = {
  id: string;
  place_id: string;
  consumer_id: string;
  name: string;
  role: string;
  note: string | null;
  created_at: string;
  phone: string | null;
  instagram_handle: string | null;
  member_number: string | null;
};

type ConsumerFacts = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  instagram_handle: string | null;
  code: string | null;
};

async function consumerFacts(admin: SupabaseClient, ids: string[]): Promise<Map<string, ConsumerFacts>> {
  const out = new Map<string, ConsumerFacts>();
  if (ids.length === 0) return out;
  const { data, error } = await admin
    .from("consumers")
    .select("id, first_name, last_name, phone, instagram_handle, code")
    .in("id", [...new Set(ids)]);
  if (error) {
    console.error("[place-access] consumers:", error.message);
    return out;
  }
  for (const row of (data ?? []) as ConsumerFacts[]) out.set(row.id, row);
  return out;
}

const fullName = (c: ConsumerFacts | undefined) =>
  c ? [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || null : null;

/** Who runs a place and who asked to (staff only). Best effort: a failed
 *  read is logged and reads as empty, never as a failed overview. */
export async function listPlaceOwners(
  admin: SupabaseClient,
  placeId: string,
): Promise<{ owners: OwnerView[]; pending: PendingRequestView[] }> {
  const [rows, reqs] = await Promise.all([
    admin.from("place_managers").select(MANAGER_COLUMNS).eq("place_id", placeId).is("revoked_at", null)
      .order("verified_at", { ascending: false }),
    admin.from("place_verification_requests")
      .select("id, place_id, consumer_id, name, role, note, created_at")
      .eq("place_id", placeId).eq("status", "pending").order("created_at", { ascending: true }),
  ]);
  if (rows.error) console.error("[place-access] place_managers:", rows.error.message);
  if (reqs.error) console.error("[place-access] place_verification_requests:", reqs.error.message);
  return await shapeOwners(
    admin,
    (rows.data ?? []) as ManagerRow[],
    (reqs.data ?? []) as Omit<PendingRequestView, "phone" | "instagram_handle" | "member_number">[],
  );
}

export async function shapeOwners(
  admin: SupabaseClient,
  rows: ManagerRow[],
  reqs: Omit<PendingRequestView, "phone" | "instagram_handle" | "member_number">[],
): Promise<{ owners: OwnerView[]; pending: PendingRequestView[] }> {
  const facts = await consumerFacts(admin, [...rows.map((r) => r.consumer_id), ...reqs.map((r) => r.consumer_id)]);
  const now = Date.now();
  return {
    owners: rows.map((r) => {
      const c = facts.get(r.consumer_id);
      return {
        id: r.id,
        consumer_id: r.consumer_id,
        name: fullName(c),
        phone: c?.phone ?? null,
        instagram_handle: c?.instagram_handle ?? null,
        member_number: c?.code ?? null,
        method: r.method,
        verified_at: r.verified_at,
        expires_at: r.expires_at,
        live: isLiveManager(r, now),
      };
    }),
    pending: reqs.map((r) => {
      const c = facts.get(r.consumer_id);
      return {
        ...r,
        phone: c?.phone ?? null,
        instagram_handle: c?.instagram_handle ?? null,
        member_number: c?.code ?? null,
      };
    }),
  };
}
