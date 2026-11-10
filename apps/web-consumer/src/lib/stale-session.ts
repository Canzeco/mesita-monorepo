import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { withNext } from "@/lib/auth-redirect";

// MESITA-3590: a session cookie whose user is gone (an admin Reset deleted
// the account) loops the guest between `/` and /auth/post-signin. The proxy
// trusts the cookie (getClaims verifies the JWT locally), so it bounces `/`
// to post-signin; post-signin's getUser() asks Auth, gets no user, and sent
// the guest back to `/` with the cookie still set — for up to an hour, until
// the access token expired.
//
// A Server Component cannot clear cookies (Next only lets a Server Action or
// a Route Handler write them, and createServerSupabase swallows the throw),
// so the server pages send the guest through /auth/clear-session, a Route
// Handler that signs out locally and then lands on `/` with no cookie.

/** The Route Handler that clears a dead session, keeping `next`. */
export function clearSessionHref(next: string | null | undefined): string {
  return withNext("/auth/clear-session", next);
}

/**
 * True when getUser() failed for a reason that says nothing about the
 * session: Auth unreachable or a 5xx. Those must never sign anyone out, and
 * redirecting on them would loop too, so the page throws to its error
 * boundary instead.
 */
export function isTransientAuthError(error: unknown): boolean {
  if (!error) return false;
  if (isAuthRetryableFetchError(error)) return true;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && status >= 500;
}
