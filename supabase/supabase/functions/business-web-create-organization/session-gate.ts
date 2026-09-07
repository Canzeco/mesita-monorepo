// Who may mint an organization.
//
// The gate used to be "does this caller have a managers row". That read
// like authorization and was not: the row is minted lazily for any
// signed-in account — business-web-get-manager, -create-manager and
// -create-place all upsert it without asking — so its presence kept
// nobody out. What it DID do was lock out legitimate business sessions
// whose row went missing. `admin_reset_database` truncates
// public.managers and leaves auth.users standing, so every reset stranded
// every open console session behind a permanent 403 with no way back:
// the row is only ever re-created at /auth/post-signin, and a live
// session never passes through there again (MESITA-1623).
//
// The ROLE is the real gate. `app_metadata.role` is stamped at sign-in and
// records which pool the session came from, which is exactly the thing the
// old comment wanted to enforce — "letting any session mint one hands the
// claim path to every visitor". Consumer and staff sessions are refused;
// business and admin pass, the same test the two invite-accept EFs apply.
//
// An email session carrying NO role yet is a business mid-sign-up whose
// stamp has not landed. business-web-signin-email would stamp it
// 'business' on its next pass, so admit it rather than trading one dead
// end for another. A session with no email at all never came from the
// business pool — that pool is email-only.

export type SessionIdentity = { appRole: string | null; email: string | null };

export function mayCreateOrganization(user: SessionIdentity): boolean {
  if (user.appRole === "business" || user.appRole === "admin") return true;
  if (user.appRole === null && !!user.email) return true;
  return false;
}
