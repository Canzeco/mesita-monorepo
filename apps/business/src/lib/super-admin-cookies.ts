// Cookie name constants for super-admin mode. Lives in its own module so
// client components can `import` it without dragging in `next/headers`
// (which is server-only and crashes the client bundle if it leaks).

// HttpOnly: holds the actual secret. Server-only access.
export const SUPER_ADMIN_KEY_COOKIE = "mesita_super_admin_key";

// Non-HttpOnly flag readable from `document.cookie` so client components
// can tell they're in super-admin mode and route mutations through the
// Next.js proxy route instead of calling Supabase directly.
export const SUPER_ADMIN_MODE_COOKIE = "mesita_super_admin_mode";

export const SUPER_ADMIN_COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60;
