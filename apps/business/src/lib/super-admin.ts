// Super-admin mode lets the admin console deep-link an operator into any
// venue's manager pages without that operator being on the venue's team.
//
// Mechanics:
//   1. Admin console builds a link `…/unit/<id>/home?superkey=<ADMIN_ACCESS_KEY>`.
//      (The legacy `/super-admin/enter` route still works — it just redirects
//      to the same URL with the superkey query attached.)
//   2. Middleware spots `?superkey=` in the request URL, copies the value to
//      a `x-mesita-superkey` request header, and lets the request through
//      even without a Supabase session.
//   3. Server-side reads (layout, page server components) call
//      `getSuperAdminKey()` from `./super-admin-server` which reads that
//      header. Pages can also read directly from their `searchParams` via
//      `readSuperKeyFromSearchParams()` below.
//   4. Client-side mutations notice the superkey in `window.location.search`
//      and route through a Next.js Route Handler proxy that forwards to the
//      EF with the `x-super-admin-key` header.
//
// The same `ADMIN_ACCESS_KEY` value powers the admin web's admin-key cookie
// and the admin-* EFs, so there's only one secret to rotate.
//
// We do NOT validate the key here. The Supabase Edge Functions are the only
// auth gate — they compare the forwarded value against the ADMIN_ACCESS_KEY
// secret on every request. Validating here would mean duplicating the secret
// on the manager web's Vercel env, which adds a rotation surface for no
// security gain (a bad key still fails at the EF; a good key is the only
// one that does anything).
//
// IMPORTANT: This module is import-safe from anywhere (middleware, client,
// server). The `next/headers` reader lives in `./super-admin-server` —
// importing it from a client component or middleware breaks the bundler.

// The single source of truth for the query-string param name and the
// internal request header middleware sets. Used by every link builder.
export const SUPER_ADMIN_QUERY_PARAM = "superkey";
export const SUPER_ADMIN_HEADER = "x-mesita-superkey";

// Pull the superkey out of a Next.js page's `searchParams` prop. Pages get
// this directly from the URL — no middleware needed. Use this when you
// already have searchParams in hand to avoid touching `headers()`.
export function readSuperKeyFromSearchParams(
  sp: Record<string, string | string[] | undefined> | undefined,
): string | null {
  if (!sp) return null;
  const raw = sp[SUPER_ADMIN_QUERY_PARAM];
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].length > 0) {
    return raw[0];
  }
  return null;
}

// Append `?superkey=<key>` to an href when present. No-op when the key is
// null / undefined / empty. Handles hrefs that already carry a query string.
export function withSuperKey(href: string, key: string | null): string {
  if (!key) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}${SUPER_ADMIN_QUERY_PARAM}=${encodeURIComponent(key)}`;
}
