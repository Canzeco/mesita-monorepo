import type { NextRequest } from "next/server";
import { updateAdminSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateAdminSession(request);
}

export const config = {
  // Skip static assets and Next.js internals — auth-aware checks only
  // need to run on real route requests.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
