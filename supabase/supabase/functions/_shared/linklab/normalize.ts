// linklab — URL/handle normalization + scoring.
// Pure, dependency-free so both the EF and the local benchmark runner can import it.

/** Lowercase registrable host of a URL, sans scheme / `www.` / path / query / hash.
 *  Returns null for junk / non-http. Used as the website match key. */
export function normWebsiteHost(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  let host = u.hostname.toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);
  // reject obvious non-official aggregators / socials as a "website"
  if (BLOCKED_WEBSITE_HOSTS.some((h) => host === h || host.endsWith("." + h))) return null;
  return host || null;
}

const BLOCKED_WEBSITE_HOSTS = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "m.facebook.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "linktr.ee",
  "linktree.com",
  "tripadvisor.com",
  "tripadvisor.com.mx",
  "yelp.com",
  "ubereats.com",
  "rappi.com",
  "rappi.com.mx",
  "didiglobal.com",
  "opentable.com",
  "opentable.com.mx",
  "resy.com",
  "google.com",
  "goo.gl",
  "maps.app.goo.gl",
  "wa.me",
  "whatsapp.com",
  "menu.com",
  "sircreated.com",
  "foursquare.com",
  "youtube.com",
  // NOTE: builder domains (wixsite.com, mystrikingly.com, etc.) are NOT blocked —
  // small places genuinely host their official site there.
];

/** Instagram handle (lowercase) from any instagram URL, or null.
 *  Rejects post/reel/explore/tag paths — we only want profile handles. */
export function normInstagramHandle(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  // allow bare "@handle" or "handle"
  if (/^@?[a-z0-9._]+$/i.test(s) && !s.includes("/") && !s.includes(".com")) {
    const h = s.replace(/^@/, "").toLowerCase();
    return isReservedIgWord(h) ? null : h;
  }
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null;
  const seg = u.pathname.split("/").filter(Boolean);
  if (!seg.length) return null;
  const first = seg[0].toLowerCase();
  if (isReservedIgWord(first)) return null;
  if (!/^[a-z0-9._]+$/.test(first)) return null;
  return first;
}

function isReservedIgWord(h: string): boolean {
  return [
    "p",
    "reel",
    "reels",
    "explore",
    "tags",
    "tag",
    "stories",
    "tv",
    "accounts",
    "about",
    "directory",
    "developer",
    "legal",
    "privacy",
  ].includes(h);
}


