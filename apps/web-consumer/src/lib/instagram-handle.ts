// An Instagram username as the app accepts it: the client twin of
// normalizeHandle in supabase/.../_shared/instagram-claim.ts, so a bad
// username is caught before the call. The server checks again.

const HANDLE_RE = /^[a-z0-9._]{1,30}$/;
const PROFILE_URL_RE = /^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/@?([^/?#]+)\/?(?:[?#].*)?$/i;
/** instagram.com paths that are not a profile. */
const NOT_PROFILES = new Set(["p", "reel", "reels", "stories", "explore", "accounts", "tv", "direct"]);

/** `@Foo.Bar `, `foo.bar` or a profile URL → `foo.bar`, else null. */
export function normalizeInstagramHandle(raw: string): string | null {
  const typed = raw.trim();
  const url = PROFILE_URL_RE.exec(typed);
  const h = (url ? url[1] : typed.replace(/^@/, "")).toLowerCase();
  if (url && NOT_PROFILES.has(h)) return null;
  return HANDLE_RE.test(h) ? h : null;
}
