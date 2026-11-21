// Shared social/web channel URL classification + canonicalisation: the host
// table that maps a link to its channel column, and classifyLinks, which the
// Google Basics step uses to file a place's website. The search-result pickers
// (pickWebsite / pickInstagram / pickFacebook / pickChannel) left with the
// server's social-link verify path (MESITA-2979, MESITA-2988).

export type ChannelKey =
  | "website_url"
  | "instagram_url"
  | "facebook_url"
  | "whatsapp_url"
  | "opentable_url"
  | "uber_eats_url"
  | "tripadvisor_url"
  | "google_maps_url";

export type Channels = Record<ChannelKey, string | null>;

// Hostname → channel column. Accepts exact hostnames and subdomain matches
// (`m.facebook.com` → `facebook_url`). TripAdvisor matches its brand label so
// country TLDs and locale subdomains land (MESITA-4569).
function matchChannel(host: string): ChannelKey | null {
  const h = host.replace(/^www\./, "").toLowerCase();
  if (h === "instagram.com" || h.endsWith(".instagram.com")) return "instagram_url";
  if (h === "facebook.com" || h.endsWith(".facebook.com")) return "facebook_url";
  if (h === "fb.com" || h.endsWith(".fb.com")) return "facebook_url";
  if (h === "wa.me" || h.endsWith(".wa.me")) return "whatsapp_url";
  if (h === "whatsapp.com" || h.endsWith(".whatsapp.com")) return "whatsapp_url";
  if (h.startsWith("opentable.")) return "opentable_url";
  if (h === "ubereats.com" || h.endsWith(".ubereats.com")) return "uber_eats_url";
  if (/(^|\.)tripadvisor\./.test(h)) return "tripadvisor_url";
  // maps.google.com + goo.gl short links. (google.com/maps/* needs the path —
  // see matchChannelFromUrl / classifyLinks path check.)
  if (h === "maps.google.com" || h.endsWith(".maps.google.com")) return "google_maps_url";
  if (h === "maps.app.goo.gl" || h === "goo.gl") return "google_maps_url";
  return null;
}

// Hosts we still RECOGNISE but never track as a channel (TikTok, Yelp; X,
// Threads, Reddit, Resy and DiDi Food dropped by MESITA-4569). matchChannel
// returns null for them, and classifyLinks absorbs them here so a link to any
// of these can never leak into website_url.
function isRetiredSocialHost(host: string): boolean {
  const h = host.replace(/^www\./, "").toLowerCase();
  if (h === "tiktok.com" || h.endsWith(".tiktok.com")) return true;
  if (/(^|\.)yelp\./.test(h)) return true;
  if (["twitter.com", "x.com", "threads.net", "threads.com", "reddit.com", "resy.com", "didi.com", "sindelantal.com.mx"]
    .some((b) => h === b || h.endsWith(`.${b}`))) return true;
  if (h.startsWith("didifood.")) return true;
  return false;
}

/** google.com/maps/* (and locale hosts) — host-only matchChannel misses these. */
function isGoogleMapsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "").toLowerCase();
    if (h === "maps.google.com" || h.endsWith(".maps.google.com")) return true;
    if (h === "maps.app.goo.gl" || h === "goo.gl") return true;
    if ((h === "google.com" || h.endsWith(".google.com")) && u.pathname.startsWith("/maps")) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

// Hosts that are not a place's own website and that `matchChannel` does NOT
// already claim: search engines, encyclopaedias, link-in-bio pages, and the
// delivery aggregators Mesita has no column for. Anything matchChannel DOES
// claim is excluded by derivation inside classifyLinks, never by being re-typed
// here — the hand-typed list used to be the only guard and it had drifted: it
// named opentable.com but not ubereats.com, so an Uber Eats store page
// resolved as a place's official website and landed in `website_url` beside
// the SAME store's `uber_eats_url` (MESITA-2030, observed in production).
//
// Matched on the BRAND LABEL anywhere in the host — the same shape
// isRetiredSocialHost uses — so country TLDs and locale subdomains both land.
// A plain suffix list does not: the first cut of this fix listed `rappi.com`
// and sailed straight past `rappi.com.mx`, which is the host Mexico actually
// serves. Aggregators matchChannel already owns (ubereats, didi) are repeated
// here deliberately: their country TLDs are exactly where that table's exact
// `.com` rules run out.
const NOT_A_WEBSITE_BRANDS =
  /(^|\.)(rappi|doordash|grubhub|postmates|seamless|ubereats|didifood|google|bing|duckduckgo|wikipedia|foursquare|linkedin|youtube|linktr|beacons|menudo)\./;

// Exact hosts whose label is too generic to brand-match (`bio.` would swallow
// any `bio.<place>.com`) or that have no country variant to chase.
const NOT_A_WEBSITE_HOSTS = ["goo.gl", "youtu.be", "bio.link"];

/** True when this host can never be a place's own site. classifyLinks asks it
 * before a link may land in website_url. */
function isNotAWebsiteHost(host: string): boolean {
  const h = host.replace(/^www\./, "").toLowerCase();
  if (NOT_A_WEBSITE_BRANDS.test(h)) return true;
  return NOT_A_WEBSITE_HOSTS.some((b) => h === b || h.endsWith(`.${b}`));
}

// Trim tracking junk + trailing slashes so two near-identical links from the
// same host collapse to one before we pick the shortest.
function canonicaliseUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const drop = ["ref", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid"];
    drop.forEach((k) => u.searchParams.delete(k));
    u.hash = "";
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return null;
  }
}

// Classify a bag of links into channel columns, picking the shortest URL per
// channel (a heuristic for "profile root over deep link"; ties keep the first
// occurrence, which preserves Google-provided URIs over scraped ones).
export function classifyLinks(input: (string | null | undefined)[]): Channels {
  const buckets: Partial<Record<ChannelKey, string[]>> = {};
  const websiteCandidates: string[] = [];

  for (const raw of input) {
    if (!raw) continue;
    const url = canonicaliseUrl(raw);
    if (!url) continue;
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      continue;
    }
    const channel = matchChannel(host);
    if (channel) {
      (buckets[channel] ??= []).push(url);
    } else if (isGoogleMapsUrl(url)) {
      (buckets.google_maps_url ??= []).push(url);
    } else if (!isRetiredSocialHost(host) && !isNotAWebsiteHost(host)) {
      websiteCandidates.push(url);
    }
  }

  const pickShortest = (arr: string[] | undefined): string | null => {
    if (!arr || arr.length === 0) return null;
    let best = arr[0];
    for (const v of arr) {
      if (v.length < best.length) best = v;
    }
    return best;
  };

  return {
    website_url: pickShortest(websiteCandidates),
    instagram_url: pickShortest(buckets.instagram_url),
    facebook_url: pickShortest(buckets.facebook_url),
    whatsapp_url: pickShortest(buckets.whatsapp_url),
    opentable_url: pickShortest(buckets.opentable_url),
    uber_eats_url: pickShortest(buckets.uber_eats_url),
    tripadvisor_url: pickShortest(buckets.tripadvisor_url),
    google_maps_url: pickShortest(buckets.google_maps_url),
  };
}
