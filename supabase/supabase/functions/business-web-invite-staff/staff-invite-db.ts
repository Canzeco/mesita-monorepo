import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "../_shared/http.ts";
import { phonesMatch } from "../_shared/phone.ts";
import { newInviteToken } from "../_shared/tokens.ts";

export async function insertStaffInvite(
  admin: SupabaseClient,
  opts: {
    projectId: string;
    phone: string | null;
    channel: string;
    createdBy: string;
    expiresAt: string;
  },
): Promise<
  | {
      ok: true;
      row: {
        id: string;
        token: string;
        phone: string | null;
        channel: string;
        expires_at: string;
      };
    }
  | { ok: false; response: Response }
> {
  const token = newInviteToken();
  const insert = await admin
    .from("staff_invites")
    .insert({
      project_id: opts.projectId,
      token,
      phone: opts.phone,
      channel: opts.channel,
      created_by: opts.createdBy,
      expires_at: opts.expiresAt,
    })
    .select("id, token, phone, channel, expires_at")
    .single();

  if (insert.error) {
    if (opts.phone && insert.error.code === "23505") {
      const existing = await findPendingStaffInviteForPlacePhone(
        admin,
        opts.projectId,
        opts.phone,
      );
      if (existing) {
        const updated = await admin
          .from("staff_invites")
          .update({
            token: newInviteToken(),
            channel: opts.channel,
            expires_at: opts.expiresAt,
          })
          .eq("id", existing.id)
          .select("id, token, phone, channel, expires_at")
          .single();
        if (!updated.error && updated.data) {
          return { ok: true, row: updated.data };
        }
      }
    }
    return {
      ok: false,
      response: json(
        { ok: false, error: `invite_insert: ${insert.error.message}` },
        500,
      ),
    };
  }

  return { ok: true, row: insert.data };
}

export async function findPendingStaffInviteForPlacePhone(
  admin: SupabaseClient,
  projectId: string,
  phoneE164: string,
): Promise<{ id: string } | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("staff_invites")
    .select("id, phone")
    .eq("project_id", projectId)
    .is("claimed_at", null)
    .gt("expires_at", nowIso)
    .not("phone", "is", null);

  if (error || !data?.length) return null;
  for (const row of data) {
    if (row.phone && phonesMatch(row.phone, phoneE164)) {
      return { id: row.id };
    }
  }
  return null;
}

export async function isPhoneAlreadyStaffAtPlace(
  admin: SupabaseClient,
  projectId: string,
  phoneE164: string,
): Promise<boolean> {
  const digits = phoneE164.replace(/\D/g, "");
  const { data: userId, error } = await admin.rpc("find_user_id_by_phone", {
    phone_digits: digits,
  });
  if (error || !userId) return false;

  const { data: role } = await admin
    .from("project_roles")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("role", "staff")
    .maybeSingle();

  return !!role;
}
