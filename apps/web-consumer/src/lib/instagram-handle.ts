// An Instagram username as the app accepts it: the client twin of
// normalizeHandle in supabase/.../_shared/instagram-claim.ts, so a bad
// username is caught before the call. The server checks again.

const HANDLE_RE = /^[a-z0-9._]{1,30}$/;

/** `@Foo.Bar ` → `foo.bar`, or null when it is not an Instagram username. */
export function normalizeInstagramHandle(raw: string): string | null {
  const h = raw.trim().replace(/^@/, "").toLowerCase();
  return HANDLE_RE.test(h) ? h : null;
}
