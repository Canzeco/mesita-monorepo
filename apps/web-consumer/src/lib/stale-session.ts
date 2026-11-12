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

// MESITA-3808: a session Auth revoked under an open window (a sign-out in
// another window used to revoke them all; an admin Reset; a refresh token
// gone) kept the window polling with its dead token — Home › Social asked
// every minute and got 401 "Invalid session" all night, the screen still
// drawn as signed in. A 401 from an Edge Function in the browser now sends
// the guest through /auth/clear-session, which signs out only a session Auth
// no longer knows and lands on sign-in keeping `next`; a live guest passes
// straight through post-signin. At most once a minute, so a 401 that a live
// session keeps drawing cannot loop the page.

const LEAVE_KEY = "mesita.dead-session-at";
export const LEAVE_EVERY_MS = 60_000;

/** Whether a 401 on `path` should leave for /auth/clear-session: never from
 *  the sign-in screen or an /auth hop (that is where it lands), and not
 *  again within LEAVE_EVERY_MS of the last time. */
export function shouldLeaveDeadSession(
  path: string,
  lastLeftAt: number | null,
  now: number,
): boolean {
  if (path === "/" || path.startsWith("/auth/") || path === "/onboard") {
    return false;
  }
  return lastLeftAt == null || now - lastLeftAt >= LEAVE_EVERY_MS;
}

/** Browser only: send the guest through /auth/clear-session after a 401.
 *  True when it is leaving (the caller says nothing else). */
export function leaveDeadSession(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname + window.location.search;
  let last: number | null = null;
  try {
    const raw = window.sessionStorage.getItem(LEAVE_KEY);
    last = raw ? Number(raw) : null;
    if (last != null && !Number.isFinite(last)) last = null;
  } catch {
    // Storage blocked: the throttle is lost, the /-and-/auth guard holds.
  }
  const now = Date.now();
  if (!shouldLeaveDeadSession(window.location.pathname, last, now)) {
    return false;
  }
  try {
    window.sessionStorage.setItem(LEAVE_KEY, String(now));
  } catch {
    // see above
  }
  window.location.assign(clearSessionHref(path));
  return true;
}
