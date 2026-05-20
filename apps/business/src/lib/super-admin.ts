// Super-admin mode lets the admin console deep-link an operator into any
// venue's manager pages without that operator being on the venue's team.
//
// Mechanics:
//   1. Admin console builds a link `…/super-admin/enter?token=<ADMIN_ACCESS_KEY>&placeId=<X>`.
//   2. The entry route handler validates the token against the env var,
//      resolves the placeId → venue.id via service role, sets the two cookies
//      below, and redirects to /unit/<id>/place.
//   3. Server-side reads (layout, page server components) call EFs with the
//      `x-super-admin-key` header instead of a Supabase bearer JWT.
//   4. Client-side mutations are proxied through Next.js Route Handlers that
//      read the HttpOnly cookie and forward to the EF with the same header.
//
// The same `ADMIN_ACCESS_KEY` value powers the admin web's admin-key cookie
// and the admin-* EFs, so there's only one secret to rotate.

// Server-only: this module reads HttpOnly cookies via `next/headers`. If a
// client component ever imports it Next.js will throw at use-site. Cookie
// name constants live in `super-admin-cookies.ts` so they're safe to share.
import { cookies } from "next/headers";
import { SUPER_ADMIN_KEY_COOKIE } from "./super-admin-cookies";

export {
  SUPER_ADMIN_KEY_COOKIE,
  SUPER_ADMIN_MODE_COOKIE,
  SUPER_ADMIN_COOKIE_MAX_AGE_SECONDS,
} from "./super-admin-cookies";

export async function getSuperAdminKey(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SUPER_ADMIN_KEY_COOKIE)?.value ?? null;
}

// Throws if the cookie is missing or doesn't match ADMIN_ACCESS_KEY. The
// matcher exists so server code can validate before passing the key onward
// — never trust the cookie's presence alone, since the env var may have
// been rotated since the cookie was set.
export async function readVerifiedSuperAdminKey(): Promise<string | null> {
  const expected = process.env.ADMIN_ACCESS_KEY;
  if (!expected) return null;
  const cookieKey = await getSuperAdminKey();
  if (!cookieKey) return null;
  if (cookieKey !== expected) return null;
  return cookieKey;
}
