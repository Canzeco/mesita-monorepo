// The first step of consumer-web-delete-account (MESITA-3777): one Google
// account signs into Consumer, Business and Admin, so closing the guest
// account would also wipe a place owner's Business access or a super-admin's
// Admin. Those accounts are refused here, before Stripe or the tombstone.

export type CloseGuardDeps = {
  /** Live place_managers rows for this consumer (revoked_at is null). */
  managesPlace: () => Promise<{ ok: true; value: boolean } | { ok: false; error: string }>;
  /** A super_admins row by this email or this user id. */
  isSuperAdmin: () => Promise<{ ok: true; value: boolean } | { ok: false; error: string }>;
};

export type CloseGuard =
  | { ok: true }
  | { ok: false; status: number; body: Record<string, unknown> };

export const RUNS_A_PLACE_MESSAGE =
  "This account also runs a place on Mesita Business. Close the place there first.";
export const ADMIN_MESSAGE = "This account is a Mesita admin and can't be closed here.";

export async function closeGuard(deps: CloseGuardDeps): Promise<CloseGuard> {
  const admin = await deps.isSuperAdmin();
  if (!admin.ok) return { ok: false, status: 500, body: { ok: false, error: `super_admin_read: ${admin.error}` } };
  if (admin.value) return { ok: false, status: 409, body: { ok: false, code: "is_admin", error: ADMIN_MESSAGE } };
  const place = await deps.managesPlace();
  if (!place.ok) return { ok: false, status: 500, body: { ok: false, error: `place_managers_read: ${place.error}` } };
  if (place.value) return { ok: false, status: 409, body: { ok: false, code: "runs_a_place", error: RUNS_A_PLACE_MESSAGE } };
  return { ok: true };
}
