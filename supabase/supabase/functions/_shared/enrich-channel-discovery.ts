// The Resolver's prompt — "Review & Select Links" (MESITA-197). The Enricher on
// Render (render/src/links.ts) runs the Firecrawl gather and the Perplexity
// select. This file keeps the Resolver's instructions, which enrich-start.ts
// sends to Render, and the per-place message template admin Crenup renders
// (crenup-prompts.ts).
//
// SCOPE — CHANNELS ONLY. The Resolver resolves the place's OWN online channel
// URLs. It does NOT discover phone or email: those come from Mesita input or
// the Google Places identity spine, never from a web search.

export type ChannelField =
  | "website_url"
  | "instagram_url"
  | "facebook_url"
  | "opentable_url"
  | "uber_eats_url";

// Channels the discovery pass actively searches for. TripAdvisor / Yelp are
// RETIRED product-wide (same posture as TikTok) — not discovered, not
// persisted; their columns stay dormant.
export const CHANNEL_FIELDS: ChannelField[] = [
  "website_url",
  "instagram_url",
  "facebook_url",
  "opentable_url",
  "uber_eats_url",
];

// Exported so admin Crenup can RENDER it (crenup-prompts.ts → the console). The
// console shows this exact constant, so what an operator reads is what the
// vendor receives — a second copy could drift, this cannot.
export const RESOLVER_INSTRUCTIONS =
  "You choose a place's official online channels. You are given candidate URLs, each " +
  "with its page title, description and where it came from when known, plus web access " +
  "to check them. For each requested field, return the one candidate that really is this " +
  "place's own channel, or null. Check the name, the city and the kind of business; a " +
  "similar name in another city or country, or a different business, is null. " +
  "A candidate linked from the place's own website is the strongest evidence, and the " +
  "same handle on the website and another channel wins. That holds only when the site is " +
  "the place's or its brand's: a mall, group, magazine or directory page links its own " +
  "accounts, and a group page may list one account per branch, so take the one for this " +
  "city. Prefer this location's own account over a parent group or a branch elsewhere. " +
  "When this location has none (a branch of a chain or franchise, a kiosk, a counter " +
  "inside a campus, mall, hospital or airport), the brand's main account IS this place's " +
  "channel, this country's first. Between several official accounts of the same place, " +
  "take the current one with the most followers. website_url is the place's or brand's " +
  "own site, never an article, review, ranking, guide, directory, aggregator or delivery " +
  "page. instagram_url and facebook_url are profiles or pages, never a post or a video. " +
  "opentable_url and uber_eats_url must be this place's page, or its brand's in this " +
  "city. Return null only when no candidate is this place or its brand. Output ONLY " +
  "strict JSON matching the schema. Never fabricate a URL.";

// The per-place message. Pure and exported so crenup-prompts.ts can render the
// REAL template with sentinel values — the console never re-types this prose.
// The Enricher on Render sends this same text (resolverInput in
// render/src/links.ts), pinned by render/src/twins.test.ts.
export function buildResolverInput(
  place: { name: string; city: string | null; category: string | null; brand: string | null; context: string },
  candidates: Partial<Record<ChannelField, string[]>>,
): string {
  const where = place.city?.trim() ? ` in ${place.city.trim()}` : "";
  const kind = place.category?.trim() ? ` (category: ${place.category.trim()})` : "";
  const lists = Object.entries(candidates).map(([field, lines]) =>
    `${field} candidates:\n${(lines ?? []).join("\n")}`
  ).join("\n");
  const context = place.context.trim();
  return `Review and select the official channels for the place "${place.name}"${where}${kind}.\n\n` +
    (context ? `Background on the place (soft web context — never the source of a URL):\n${context.slice(0, 600)}\n\n` : "") +
    (place.brand
      ? `This place is a location of the "${place.brand}" brand. If it has no account of its own, ` +
        `the brand's account is the answer, preferring this country's.\n\n`
      : "") +
    `Candidate URLs, each with its page title, description and origin when known:\n${lists}\n\n` +
    "Return strict JSON. Each value is one URL from that field's list, or null. Never invent a URL.";
}
