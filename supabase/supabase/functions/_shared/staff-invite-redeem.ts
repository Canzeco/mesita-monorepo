// Redeem staff_invites — consumed by the Ops WhatsApp flow
// (business-whats-handle-message via _shared/staff-invite-whatsapp.ts).

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { phoneDigits } from "./phone.ts";
import { type PendingStaffInvite } from "./staff-invite-lookup.ts";

export type { PendingStaffInvite } from "./staff-invite-lookup.ts";
export {
  findPendingStaffInviteByToken,
  findPendingStaffInviteForPhone,
} from "./staff-invite-lookup.ts";

export async function ensureAuthUserForStaffPhone(
  admin: SupabaseClient,
  phoneE164: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const digits = phoneDigits(phoneE164);
  const existing = await admin.rpc("find_user_id_by_phone", {
    phone_digits: digits,
  });
  const userId = existing.data as string | null;
  if (userId) return { ok: true, userId };

  const created = await admin.auth.admin.createUser({
    phone: phoneE164,
    phone_confirm: true,
    app_metadata: { role: "staff" },
  });
  if (created.error) {
    return { ok: false, error: created.error.message };
  }
  if (!created.data.user?.id) {
    return { ok: false, error: "create_user_missing_id" };
  }
  return { ok: true, userId: created.data.user.id };
}

export async function redeemStaffInvite(
  admin: SupabaseClient,
  opts: { invite: PendingStaffInvite; userId: string },
): Promise<
  | { ok: true; projectId: string; placeName: string }
  | { ok: false; error: string; code: string }
> {
  const { invite, userId } = opts;
  if (invite.claimed_at) {
    return { ok: false, error: "already_claimed", code: "claimed" };
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "expired", code: "expired" };
  }
  const upsert = await admin
    .from("project_roles")
    .upsert(
      {
        user_id: userId,
        project_id: invite.project_id,
        role: "staff",
        invited_by: invite.created_by,
      },
      { onConflict: "user_id,project_id", ignoreDuplicates: false },
    )
    .select("user_id, project_id, role")
    .single();
  if (upsert.error) {
    return { ok: false, error: upsert.error.message, code: "project_roles" };
  }

  const claim = await admin
    .from("staff_invites")
    .update({ claimed_at: new Date().toISOString(), claimed_by: userId })
    .eq("id", invite.id)
    .is("claimed_at", null);
  if (claim.error) {
    return { ok: false, error: claim.error.message, code: "claim" };
  }

  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const currentRole =
    (userData.user?.app_metadata as Record<string, unknown> | null)?.role as
      | string
      | undefined;
  if (currentRole !== "business" && currentRole !== "admin") {
    const stamp = await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...(userData.user?.app_metadata ?? {}),
        role: "staff",
      },
    });
    if (stamp.error) {
      return { ok: false, error: stamp.error.message, code: "role_stamp" };
    }
  }

  return { ok: true, projectId: invite.project_id, placeName: invite.place_name };
}
