import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";

// Gate every admin route behind the shared password. /login is the only
// page that renders without a session — everything else 307s to /login
// with a ?next= so the post-login redirect lands the visitor back where
// they wanted to be.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The login page is the only public surface inside the app.
  if (pathname === "/login") return NextResponse.next();

  const expected = process.env.ADMIN_PASSWORD;
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (isValidSession(cookie, expected)) {
    return NextResponse.next();
  }

  // Bounce. Preserve where they were trying to go (only safe relative
  // paths — refuse absolute or protocol-relative to avoid open-redirect).
  const next = pathname + request.nextUrl.search;
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search =
    pathname === "/" || pathname === ""
      ? ""
      : `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip static assets and Next.js internals. The session check only
  // matters for routes that render UI.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
