import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client. Used in server components, route handlers,
// and server actions. Reads + refreshes cookies via the Next.js cookies()
// store so the SSR session stays in sync with the browser session.
export async function createServerSupabase() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              jar.set(name, value, options);
            }
          } catch {
            // The cookies() jar is read-only in some contexts (e.g. inside
            // a server component during render). Supabase calls setAll
            // defensively for token refresh; we can safely ignore the
            // throw — the middleware will refresh on the next request.
          }
        },
      },
    },
  );
}
