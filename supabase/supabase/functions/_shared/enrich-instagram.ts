// Atlas source — Apify Instagram: followers + bio + post IMAGES (top by likes).
//
// IDENTITY-CHECKED but GENEROUS: scrape the candidate and confirm it's this
// place's OR its brand's account (website-domain match, FB-slug agreement,
// brand-name match, else a true-biased LLM judge) — a franchise's single brand
// account is a valid result. Candidates are tried in order — the Firecrawl/
// Google handle, then the Facebook slug reused as a handle, then a Perplexity-
// resolved handle — keeping the first that passes. Only a genuinely dead/
// nonexistent handle is dropped: a missing IG is the worse miss, so when in
// doubt we attach the brand account rather than nothing.

import { APIFY_ACTORS, instagramHandleFromUrl, runApifyActor } from "./apify.ts";
import { numOf } from "./parse-utils.ts";
import { selectChannels } from "./enrich-channel-discovery.ts";
import { igProfileMatchesPlace, isDeadIgStub } from "./enrich-instagram-match.ts";

export type InstagramPlaceCtx = {
  name: string;
  locationLine: string;
  website: string | null;
  facebook: string | null;
  category: string | null;
};

export type InstagramAssetMeta = {
  likes_count: number | null;
  caption: string | null;
  source_metadata: Record<string, unknown>;
};

export type InstagramResult = {
  verifiedInstagramUrl: string | null;
  igBio: string;
  igFollowers: number | null;
  instagramImages: string[];
  instagramAssetMeta: Map<string, InstagramAssetMeta>;
  diag: Record<string, unknown>;
};

export async function gatherInstagram(opts: {
  apifyKey: string;
  openaiKey: string | undefined;
  perplexityKey: string | undefined;
  place: InstagramPlaceCtx;
  igHandle: string | null;
  fbHandleCandidate: string | null;
  // DEPTH = posts pulled from the scrape (preselection window); POSTS = kept after
  // the likes-sort (keep ≤ depth). See enrich-config (child D / MESITA-201).
  gatherInstagramDepth: number;
  gatherInstagramPosts: number;
}): Promise<InstagramResult> {
  const {
    apifyKey,
    openaiKey,
    perplexityKey,
    place,
    igHandle,
    fbHandleCandidate,
    gatherInstagramDepth,
    gatherInstagramPosts,
  } = opts;
  // Never keep more than we downloaded.
  const keepPosts = Math.min(gatherInstagramPosts, gatherInstagramDepth);
  const instagramAssetMeta = new Map<string, InstagramAssetMeta>();
  const tried = new Set<string>();
  // handle → API-level failure ("<status>: <body head>"). When EVERY tried
  // handle failed at the API layer (vs a real scrape of a dead/other account),
  // the caller may lean on the leniency fallback — we never got to look.
  const apiErrors: Record<string, string> = {};

  // corroborateFb=true means the candidate was found INDEPENDENTLY (Firecrawl/
  // Google/Perplexity), so agreement with the Facebook slug is real corroboration.
  // The candidate we DERIVE from the Facebook slug can't use FB to vouch for
  // itself (circular), so that one must clear the website match or the LLM judge.
  const attempt = async (handle: string | null, corroborateFb = true) => {
    if (!handle || tried.has(handle.toLowerCase())) return null;
    tried.add(handle.toLowerCase());
    const run = await runApifyActor<Record<string, unknown>>(
      APIFY_ACTORS.instagramProfile,
      { usernames: [handle] },
      apifyKey,
    );
    if (run.error) apiErrors[handle] = `${run.status ?? "net"}: ${run.error}`;
    const p = run.items?.[0];
    // A NONEXISTENT handle still returns a non-null object — the username echoed
    // back with every field null/empty. Treat that empty stub as not-found so a
    // dead handle (e.g. a guessed FB-slug) never reaches the identity judge.
    if (!p || isDeadIgStub(p)) return null;
    const ok = await igProfileMatchesPlace(p, place, openaiKey, corroborateFb);
    return { handle, p, ok };
  };

  // 1) Firecrawl/Google candidate (independent → FB corroboration ok).
  let chosen = await attempt(igHandle);
  // 2) Facebook slug reused as an IG handle (derived from FB → no FB corroboration).
  if (!chosen?.ok) {
    const alt = await attempt(fbHandleCandidate, false);
    chosen = alt?.ok ? alt : (chosen ?? alt);
  }
  // 3) Last resort: ask Perplexity for the right account + verify it.
  if (!chosen?.ok && perplexityKey) {
    const pp = await selectChannels(
      perplexityKey,
      { name: place.name, locationLine: place.locationLine, category: place.category },
      new Set(["instagram_url"]),
      {},
    );
    const alt = await attempt(instagramHandleFromUrl(pp.channels.instagram_url ?? null));
    chosen = alt?.ok ? alt : (chosen ?? alt);
  }

  if (!chosen?.ok) {
    // No account passed identity verification — attach nothing here. When the
    // failure was pure infrastructure (every scrape errored at the API layer),
    // say so: the research stage then attaches the discovered handle
    // UNVERIFIED instead of dropping it (leniency — a missing channel is the
    // worse miss). A judge rejection or dead handle keeps infra_fail false.
    const failedTried = [...tried].filter((h) => apiErrors[h]);
    return {
      verifiedInstagramUrl: null,
      igBio: "",
      igFollowers: null,
      instagramImages: [],
      instagramAssetMeta,
      diag: {
        ok: false,
        reason: chosen ? "unverified" : "not_found",
        candidate: igHandle ?? fbHandleCandidate,
        tried: [...tried],
        infra_fail: tried.size > 0 && failedTried.length === tried.size,
        ...(failedTried.length > 0 ? { errors: apiErrors } : {}),
      },
    };
  }

  const p = chosen.p;
  const igFollowers = numOf(p.followersCount);
  const igBio = typeof p.biography === "string" ? p.biography : "";

  // Post depth (child D / MESITA-201): the profile scrape only embeds the first
  // grid page (~12 posts). When the admin "Instagram depth" knob asks for more,
  // fetch the verified account's latest DEPTH via the dedicated post scraper.
  // The actor returns posts by RECENCY (newest first) — it has no sort-by-likes
  // option — so we rank that window by likes ourselves and keep the top
  // `keepPosts` below. `skipPinnedPosts` drops pinned posts, which are usually
  // logos/announcements/promos rather than representative gallery shots. The
  // embedded posts stay as the fallback so a posts-run failure never loses the
  // images the profile call already delivered.
  let posts = Array.isArray(p.latestPosts) ? (p.latestPosts as Record<string, unknown>[]) : [];
  let postsSource = "profile-embedded";
  let postsError: string | null = null;
  if (gatherInstagramDepth > posts.length) {
    const postsRun = await runApifyActor<Record<string, unknown>>(
      APIFY_ACTORS.instagramPosts,
      { username: [chosen.handle], resultsLimit: gatherInstagramDepth, skipPinnedPosts: true },
      apifyKey,
      60000,
    );
    if (postsRun.items && postsRun.items.length > 0) {
      // The post scraper marks videos via `type`/`videoUrl` instead of the
      // profile scraper's `isVideo` — normalize so the meta below just works.
      posts = postsRun.items.map((it) => ({
        ...it,
        isVideo: it.isVideo ??
          (it.type === "Video" || (typeof it.videoUrl === "string" && it.videoUrl.length > 0)),
      }));
      postsSource = "post-scraper";
    } else if (postsRun.error) {
      postsError = `${postsRun.status ?? "net"}: ${postsRun.error}`;
    }
  }

  const orderedPosts = posts
    // Videos are kept: their displayUrl is the cover frame, analyzed as a photo.
    .filter(
      (po) => typeof po.displayUrl === "string" && (po.displayUrl as string).startsWith("http"),
    )
    .sort((a, b) => (numOf(b.likesCount) ?? 0) - (numOf(a.likesCount) ?? 0))
    .slice(0, keepPosts);
  const instagramImages = orderedPosts.map((po) => po.displayUrl as string);
  for (const po of orderedPosts) {
    const url = po.displayUrl as string;
    instagramAssetMeta.set(url, {
      likes_count: numOf(po.likesCount),
      caption: typeof po.caption === "string" ? po.caption : null,
      source_metadata: {
        comments_count: numOf(po.commentsCount),
        is_video: !!po.isVideo,
        shortcode: typeof po.shortCode === "string" ? po.shortCode : null,
        timestamp:
          typeof po.timestamp === "string" || typeof po.timestamp === "number"
            ? po.timestamp
            : null,
      },
    });
  }
  return {
    verifiedInstagramUrl: `https://www.instagram.com/${chosen.handle}`,
    igBio,
    igFollowers,
    instagramImages,
    instagramAssetMeta,
    diag: {
      handle: chosen.handle,
      ok: true,
      verified: true,
      posts: posts.length,
      posts_source: postsSource,
      ...(postsError ? { posts_error: postsError } : {}),
      images: instagramImages.length,
    },
  };
}
