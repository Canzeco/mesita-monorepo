// consumer-web-signin-phone's decisions, kept out of index.ts so every exit
// is tested with no network: the database calls come in as functions.
//
// Every consumer sign-in lands here after Auth: a phone code, Continue with
// Google or an email code (MESITA-3777). The name says "phone" because the
// EF name is its ACL; renaming it buys nothing.
//
//   no phone and no email ─────────────────────────────> 400 no_identity
//   role: keep staff/business/admin, else stamp consumer (once)
//   row:  createRow (ensureConsumer: phone or null) ─> readRow (SIGNIN_SELECT)
//         deleted ──────────────────────────────────────> 410 account_deleted
//         session has a phone that differs ──> syncPhone (a session with no
//         phone never blanks a stored one)
//   200 { role, consumer, onboarded }
//
// `onboarded` is the browse gate: first name + birthday + sex, the same
// predicate as web lib/consumer-onboarding.ts `consumerCanBrowse`
// (MESITA-1829). Keep them in lock-step or the guest ping-pongs.

export type SigninRow = {
  id: string;
  code: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  birthday: string | null;
  sex: string | null;
  deleted_at?: string | null;
};

export type SigninUser = {
  id: string;
  email: string | null;
  phone: string | null;
  appMetadata: Record<string, unknown> | null;
};

export type SigninDeps = {
  stampRole: (role: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  createRow: () => Promise<{ ok: true } | { ok: false; status: number; error: string; code?: string }>;
  readRow: () => Promise<{ ok: true; row: SigninRow | null } | { ok: false; error: string }>;
  syncPhone: (phone: string) => Promise<{ ok: true; row: SigninRow } | { ok: false; error: string }>;
  log: (line: string) => void;
};

export type SigninReply = { status: number; body: Record<string, unknown> };

const KEEP_ROLES = new Set(["staff", "business", "admin"]);

export function providersOf(appMetadata: Record<string, unknown> | null): string[] {
  const list = appMetadata?.providers;
  if (Array.isArray(list)) return list.filter((p): p is string => typeof p === "string");
  return typeof appMetadata?.provider === "string" ? [appMetadata.provider] : [];
}

export function isOnboarded(row: SigninRow | null): boolean {
  return !!row?.first_name && !!row?.birthday && (row?.sex === "male" || row?.sex === "female");
}

export async function handleSignin(user: SigninUser, deps: SigninDeps): Promise<SigninReply> {
  if (!user.phone && !user.email) {
    return { status: 400, body: { ok: false, code: "no_identity", error: "Sign in with a phone, Google or email." } };
  }
  // One line per sign-in: which doors this account has. No email or phone.
  deps.log(`[consumer-web-signin-phone] user=${user.id} providers=${providersOf(user.appMetadata).join(",") || "none"}`);

  const currentRole = user.appMetadata?.role as string | undefined;
  const role = currentRole && KEEP_ROLES.has(currentRole) ? currentRole : "consumer";
  if (role !== currentRole) {
    const stamped = await deps.stampRole(role);
    if (!stamped.ok) return { status: 500, body: { ok: false, error: `role_stamp: ${stamped.error}` } };
  }

  const created = await deps.createRow();
  if (!created.ok) {
    return { status: created.status, body: { ok: false, error: created.error, ...(created.code ? { code: created.code } : {}) } };
  }
  const read = await deps.readRow();
  if (!read.ok) return { status: 500, body: { ok: false, error: `consumer_read: ${read.error}` } };
  let row = read.row;
  if (row && typeof row.deleted_at === "string" && row.deleted_at.length > 0) {
    return { status: 410, body: { ok: false, error: "This account is closed.", code: "account_deleted" } };
  }
  if (row && user.phone && row.phone !== user.phone) {
    const synced = await deps.syncPhone(user.phone);
    if (!synced.ok) return { status: 500, body: { ok: false, error: `consumer_phone_sync: ${synced.error}` } };
    row = synced.row;
  }
  if (row && "deleted_at" in row) {
    row = { ...row };
    delete row.deleted_at;
  }
  return { status: 200, body: { ok: true, role, consumer: row, onboarded: isOnboarded(row) } };
}
