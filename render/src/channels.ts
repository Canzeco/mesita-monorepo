// priceLevelFromGoogle + PRICE_LADDERS: twin of supabase _shared/enrich-google-basics-normalizers.ts, pinned by twins.test.ts.
// Google's websiteUri is one link. It is not always the place's own site:
// Instagram, Facebook, OpenTable, and the delivery apps show up there too.
// WhatsApp stays off the write. It is an operator field.

export type GoogleChannel =
  | "website_url"
  | "instagram_url"
  | "facebook_url"
  | "x_url"
  | "threads_url"
  | "reddit_url"
  | "opentable_url"
  | "resy_url"
  | "uber_eats_url"
  | "didi_food_url";

const NOT_A_WEBSITE =
  /(^|\.)(rappi|doordash|grubhub|postmates|seamless|ubereats|didifood|google|bing|duckduckgo|wikipedia|foursquare|linkedin|youtube|linktr|beacons|menudo|tripadvisor|yelp|tiktok)\./;

const NOT_A_WEBSITE_HOSTS = ["goo.gl", "youtu.be", "bio.link"];

/** Google's `priceRange`: per person, `units` a decimal string. */
export type GooglePriceRange = {
  startPrice?: { currencyCode?: string; units?: string };
  endPrice?: { currencyCode?: string; units?: string };
};

// THE RANGE FEEDS THE $$ (Pato, MESITA-2860: "include price range in $$$$
// stuff"): many places carry no `priceLevel` but do carry Google's numeric
// range ("MX$100–200"). The start price per person picks the level; a
// currency with no ladder here gives none. Tune the ladders, nothing else.
const PRICE_LADDERS: Record<string, [number, number, number]> = {
  MXN: [200, 400, 1000],
  USD: [10, 20, 50],
};

function priceLevelFromRange(
  range: GooglePriceRange | undefined,
): number | null {
  const start = range?.startPrice ?? range?.endPrice;
  const ladder = PRICE_LADDERS[start?.currencyCode?.toUpperCase() ?? ""];
  const units = Number(start?.units);
  if (!ladder || !Number.isFinite(units) || units < 0) return null;
  const step = ladder.findIndex((ceiling) => units < ceiling);
  return step === -1 ? 4 : step + 1;
}

export function priceLevelFromGoogle(
  value: string | undefined,
  range?: GooglePriceRange,
): number | null {
  switch (value) {
    case "PRICE_LEVEL_FREE":
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return priceLevelFromRange(range);
  }
}

export function channelFromUrl(
  raw: string | undefined,
): { key: GoogleChannel; url: string } | null {
  const url = canonical(raw);
  if (!url) return null;
  const host = bareHost(url);
  if (!host) return null;

  const instagram = instagramProfile(url);
  if (instagram) return { key: "instagram_url", url: instagram };
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return null;

  const facebook = facebookPage(url);
  if (facebook) return { key: "facebook_url", url: facebook };
  if (
    host === "facebook.com" ||
    host.endsWith(".facebook.com") ||
    host === "fb.com" ||
    host.endsWith(".fb.com")
  ) {
    return null;
  }

  if (
    host === "wa.me" ||
    host.endsWith(".wa.me") ||
    host === "whatsapp.com" ||
    host.endsWith(".whatsapp.com")
  ) {
    return null;
  }
  if (
    host === "twitter.com" ||
    host.endsWith(".twitter.com") ||
    host === "x.com" ||
    host.endsWith(".x.com")
  ) {
    return { key: "x_url", url };
  }
  if (
    host === "threads.net" ||
    host.endsWith(".threads.net") ||
    host === "threads.com" ||
    host.endsWith(".threads.com")
  ) {
    return { key: "threads_url", url };
  }
  if (host === "reddit.com" || host.endsWith(".reddit.com"))
    return { key: "reddit_url", url };
  if (host.startsWith("opentable.")) return { key: "opentable_url", url };
  if (host === "resy.com" || host.endsWith(".resy.com"))
    return { key: "resy_url", url };
  if (host === "ubereats.com" || host.endsWith(".ubereats.com"))
    return { key: "uber_eats_url", url };
  if (
    host === "didi.com" ||
    host.endsWith(".didi.com") ||
    host.startsWith("didifood.")
  ) {
    return { key: "didi_food_url", url };
  }
  if (
    NOT_A_WEBSITE.test(host) ||
    NOT_A_WEBSITE_HOSTS.some(
      (item) => host === item || host.endsWith(`.${item}`),
    )
  ) {
    return null;
  }
  return { key: "website_url", url };
}

function canonical(raw: string | undefined): string | null {
  const text = raw?.trim() ?? "";
  if (!text.startsWith("https://") && !text.startsWith("http://")) return null;
  try {
    const url = new URL(text);
    url.hash = "";
    if (url.pathname.length > 1 && url.pathname.endsWith("/"))
      url.pathname = url.pathname.slice(0, -1);
    return url.toString();
  } catch {
    return null;
  }
}

function bareHost(url: string): string | null {
  try {
    return new URL(url).hostname
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/^m\./, "");
  } catch {
    return null;
  }
}

function instagramProfile(url: string): string | null {
  const match = /instagram\.com\/([^/?#]+)/i.exec(url);
  if (!match) return null;
  const handle = match[1].replace(/^@/, "").trim();
  if (!handle) return null;
  if (
    new Set(["p", "reel", "reels", "explore", "stories", "tv"]).has(
      handle.toLowerCase(),
    )
  )
    return null;
  return `https://www.instagram.com/${handle}`;
}

function facebookPage(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = bareHost(url)?.replace(/^[a-z]{2}-[a-z]{2}\./, "") ?? "";
  if (!(
    host === "facebook.com" ||
    host.endsWith(".facebook.com") ||
    host === "fb.com"
  ))
    return null;
  const segment = parsed.pathname.split("/").filter(Boolean)[0];
  if (!segment) return null;
  if (segment.toLowerCase() === "profile.php") {
    const id = parsed.searchParams.get("id");
    return id && /^\d+$/.test(id)
      ? `https://www.facebook.com/profile.php?id=${id}`
      : null;
  }
  const reserved = new Set([
    "photo.php",
    "photo",
    "photos",
    "watch",
    "events",
    "event",
    "videos",
    "video",
    "reel",
    "reels",
    "story.php",
    "stories",
    "sharer",
    "sharer.php",
    "login",
    "pages",
    "groups",
    "marketplace",
    "media",
    "people",
    "help",
    "policies",
    "permalink.php",
    "search",
    "hashtag",
    "p",
  ]);
  if (reserved.has(segment.toLowerCase())) return null;
  return `https://www.facebook.com/${segment}`;
}
