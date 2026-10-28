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

type ChannelMap = Record<ChannelField, string | null>;

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

// Human-readable field spec for the Resolver selection prompt.
const FIELD_SPEC: Record<ChannelField, string> = {
  website_url: "website_url: the place's own official website (its homepage domain).",
  instagram_url:
    "instagram_url: the place's Instagram profile (instagram.com/<handle>). A brand/franchise main account is acceptable.",
  facebook_url: "facebook_url: the place's official Facebook page.",
  opentable_url:
    "opentable_url: the canonical OpenTable restaurant page (opentable.com/r/… or a country domain). A brand page is acceptable.",
  uber_eats_url:
    "uber_eats_url: the canonical Uber Eats store page (ubereats.com/.../store/...).",
};

// Exported so admin Crenup can RENDER it (crenup-prompts.ts → the console). The
// console shows this exact constant, so what an operator reads is what the
// vendor receives — a second copy could drift, this cannot.
export const RESOLVER_INSTRUCTIONS =
  "You resolve a place's official online channels. You are given candidate URLs " +
  "found by search plus web access. For each requested field, return the single " +
  "best URL for this place, or null. Prefer this location's own branch site and " +
  "accounts over a parent group when the branch has its own. When it does not — a " +
  "branch of a chain or franchise, a kiosk, a counter inside a campus, mall, " +
  "hospital or airport — the brand's main account IS this place's channel; between " +
  "brand accounts prefer the one for this country. Return null only when no " +
  "candidate plausibly belongs to the place or its brand: a missing channel is a " +
  "worse miss than a brand-level one. When the same handle is linked from the " +
  "website and from another channel, that agreement wins. Output ONLY strict JSON " +
  "matching the schema. Never fabricate a URL.";

// The per-place message. Pure and exported so crenup-prompts.ts can render the
// REAL template with sentinel values — the console never re-types this prose.
export function buildResolverInput(
  place: { name: string; locationLine: string; category: string | null },
  fields: readonly ChannelField[],
  candidates: Partial<Record<ChannelField, string[]>>,
  opts: {
    siblings?: Partial<ChannelMap>;
    serpContext?: string;
    website?: string | null;
  } = {},
): string {
  const want = new Set(fields);
  const candidateBlock = fields
    .map((f) => {
      const pool = (candidates[f] ?? []).slice(0, 10);
      return pool.length ? `${f} candidates:\n${pool.map((u) => `  - ${u}`).join("\n")}` : "";
    })
    .filter(Boolean)
    .join("\n");

  const siblings = opts.siblings ?? {};
  const sibLines = (["website_url", "instagram_url", "facebook_url"] as ChannelField[])
    .filter((f) => siblings[f])
    .map((f) => `- ${f}: ${siblings[f]}`)
    .join("\n");

  const askLines: string[] = fields.map((f) => `- ${FIELD_SPEC[f]}`);

  const igRule = want.has("instagram_url")
    ? "For instagram_url, prefer the place's OWN account over a parent brand / group / " +
      "umbrella account spanning many locations. If SEVERAL official accounts exist for " +
      "this same place (e.g. an older/secondary handle alongside a current one), pick the " +
      "FLAGSHIP: the account with the MOST FOLLOWERS and most recent activity — never an " +
      "older, secondary, regional, or lower-follower duplicate. "
    : "";

  const serpLine = (opts.serpContext ?? "").trim()
    ? `Background on the place (soft web context — never the source of a URL):\n${
      opts.serpContext!.trim().slice(0, 600)
    }\n\n`
    : "";

  const input =
    `Review and select the official channels for the place "${place.name}"` +
    (place.locationLine ? ` in ${place.locationLine}` : "") +
    (place.category ? ` (category: ${place.category})` : "") + ".\n\n" +
    serpLine +
    (sibLines
      ? `Already-known official channels (the missing ones almost always share the same brand handle / are linked from these — anchor on them):\n${sibLines}\n\n`
      : "") +
    (opts.website ? `Trust the links this official website itself lists: ${opts.website}\n\n` : "") +
    (candidateBlock ? `Candidate URLs found by search — review each and pick the correct one when present:\n${candidateBlock}\n\n` : "") +
    `Return strict JSON with ONLY these keys:\n${askLines.join("\n")}\n\n` +
    // The leniency flip (child B): FALSE POSITIVES > FALSE NEGATIVES.
    `Selection rule — LEAN TOWARD KEEPING: a plausible official link is better than ` +
    `dropping a correct one, so return a value whenever a candidate (or the web) ` +
    `plausibly IS this place's own channel. Return null for a field ONLY when NOTHING ` +
    `you can find is even plausibly this place's own presence. ${igRule}` +
    `Each URL must be the place's OWN channel — NEVER a review site, ranking / "best of" ` +
    `list, guide, directory, aggregator, a single post/video, or a source you merely cited. ` +
    `This location's own branch wins over a parent group, holding company, or umbrella brand. ` +
    `A franchise main account is not acceptable when a branch account exists. ` +
    `When this location has no account of its own (a chain branch, a kiosk, a counter ` +
    `inside a campus or mall), the brand's account is the answer, preferring this country's. ` +
    `A handle that appears on more than one of this place's own channels outranks a larger parent account. ` +
    `Never invent a URL.`;

  return input;
}
