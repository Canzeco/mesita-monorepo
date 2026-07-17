// Facebook page URL canonicalisation + slug candidates.
// Host matching / channel classification stay in channels.ts.

// Canonical Facebook page URL from any FB link, rejecting non-page paths
// (photos, videos, events, share/login). profile.php?id= pages are kept.
export function facebookPageFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/^m\./, "")
    .replace(/^[a-z]{2}-[a-z]{2}\./, "");
  if (!(host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com")) {
    return null;
  }
  const seg = u.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  if (!seg) return null;
  if (seg === "profile.php") {
    const id = u.searchParams.get("id");
    return id && /^\d+$/.test(id) ? `https://www.facebook.com/profile.php?id=${id}` : null;
  }
  const reserved = new Set([
    "photo.php", "photo", "photos", "watch", "events", "event", "videos", "video",
    "reel", "reels", "story.php", "stories", "sharer", "sharer.php", "login",
    "pages", "groups", "marketplace", "media", "people", "help", "policies",
    "permalink.php", "search", "hashtag", "p",
  ]);
  if (reserved.has(seg)) return null;
  return `https://www.facebook.com/${u.pathname.split("/").filter(Boolean)[0]}`;
}

// Bare page slug of a Facebook URL, usable as an Instagram-handle candidate
// (places reuse handles across networks). Numeric profile.php?id= pages and
// anything outside the IG handle charset (≤30 of [A-Za-z0-9._]) return null.
export function fbSlugCandidate(url: string | null | undefined): string | null {
  const page = facebookPageFromUrl(url);
  if (!page) return null;
  let seg: string;
  try {
    seg = new URL(page).pathname.split("/").filter(Boolean)[0] ?? "";
  } catch {
    return null;
  }
  if (!seg || seg === "profile.php") return null;
  return /^[A-Za-z0-9._]{2,30}$/.test(seg) ? seg : null;
}
