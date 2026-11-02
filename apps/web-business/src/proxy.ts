import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

// Next 16 renamed the "middleware" file convention to "proxy" — the
// export name + filename change together. Same runtime, same matcher.
// See: https://nextjs.org/docs/messages/middleware-to-proxy
export async function proxy(request: NextRequest) {
  return await updateSupabaseSession(request);
}

export const config = {
  // Skip static assets and Next.js internals — the session refresh only
  // matters for routes that may render auth-aware content.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
