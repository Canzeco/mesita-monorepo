// Pending staff_invites lookup — shared by redeem + Ops WhatsApp accept flow.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { phonesMatch } from "./phone.ts";

export type PendingStaffInvite = {
  id: string;
  project_id: string;
  phone: string | null;
  claimed_at: string | null;
  expires_at: string;
  created_by: string;
  place_name: string;
};

export async function findPendingStaffInviteByToken(
  admin: SupabaseClient,
  token: string,
): Promise<PendingStaffInvite | null> {
  const t = token.trim();
  if (!t) return null;
  const { data, error } = await admin
    .from("staff_invites")
    .select(
      "id, project_id, phone, claimed_at, expires_at, created_by, places(name)",
    )
    .eq("token", t)
    .is("claimed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  const join = data.places as unknown as { name: string } | null;
  return {
    id: data.id,
    project_id: data.project_id,
    phone: data.phone,
    claimed_at: data.claimed_at,
    expires_at: data.expires_at,
    created_by: data.created_by,
    place_name: join?.name ?? "your place",
  };
}

export async function findPendingStaffInviteForPhone(
  admin: SupabaseClient,
  phoneE164: string,
): Promise<PendingStaffInvite | null> {
  const { data, error } = await admin
    .from("staff_invites")
    .select(
      "id, project_id, phone, claimed_at, expires_at, created_by, places(name)",
    )
    .is("claimed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error || !data?.length) return null;

  for (const row of data) {
    if (!row.phone) continue;
    if (!phonesMatch(row.phone, phoneE164)) continue;
    const join = row.places as unknown as { name: string } | null;
    return {
      id: row.id,
      project_id: row.project_id,
      phone: row.phone,
      claimed_at: row.claimed_at,
      expires_at: row.expires_at,
      created_by: row.created_by,
      place_name: join?.name ?? "your place",
    };
  }

  return null;
}
