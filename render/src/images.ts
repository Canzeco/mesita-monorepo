// The gallery the Enrichment page describes.
// Google photos are already best-first: take that many. Instagram posts come
// back newest first: rank that window by likes, then vision the top of each.
// Vision describes, the text model ranks, and keep is how many land on the
// profile. Vision off keeps that order and does not call the model. A failed
// describe keeps the order too.

import { APIFY_USD, charge, openaiUsd } from "./cost.ts";

const GALLERY_CAP = 10;
const GOOGLE_CAP = 10;
const INSTAGRAM_CAP = 30;

const ANALYSIS_PROMPT =
  "Describe this place photo: subject (ambience / interior / exterior / food / people / detail), visual quality, lighting, and whether it is representative and appealing. Be concise and factual.";

const SORTING_PROMPT =
  "Rank these place photos best to worst for a should-we-go-tonight decision. We sell EXPERIENCES: weight beautiful place / ambience / vibe shots EQUALLY with food. Favor visual quality, representativeness, and a balanced mix. Drop duplicates, blurry, dark, or text-heavy images. As a minor tie-breaker only (never a primary or secondary criterion), prefer a hero whose shape is close to square over a strongly horizontal or vertical one, because the app shows it in a square tile.";

type FetchImpl = typeof fetch;

type ChatBody = {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export type ImageKnobs = {
  gatherGoogleImages: number;
  analyzeGoogleImages: number;
  analyzeInstagramImages: number;
  saveTotalImages: number;
  visionEnabled: boolean;
  imageAnalysisPrompt: string;
  imageSortingPrompt: string;
  visionModel: string;
  sortModel: string;
};

export type InstagramPost = { displayUrl?: unknown; likesCount?: unknown };

export function defaultImageKnobs(): ImageKnobs {
  return {
    gatherGoogleImages: 10,
    analyzeGoogleImages: 10,
    analyzeInstagramImages: 10,
    saveTotalImages: 10,
    visionEnabled: true,
    imageAnalysisPrompt: ANALYSIS_PROMPT,
    imageSortingPrompt: SORTING_PROMPT,
    visionModel: "gpt-4o-mini",
    sortModel: "gpt-4o-mini",
  };
}

export function applyPhotoOrder(urls: string[], raw: unknown, keep = GALLERY_CAP): string[] {
  const cap = clamp(keep, GALLERY_CAP);
  const order = normaliseOrder(raw, urls.length);
  if (!order) return urls.slice(0, cap);
  return order.map((index) => urls[index]).filter((url): url is string => !!url).slice(0, cap);
}

function normaliseOrder(raw: unknown, length: number): number[] | null {
  if (!Array.isArray(raw)) return null;
  const order: number[] = [];
  const seen = new Set<number>();
  for (const value of raw) {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isInteger(n) && n >= 0 && n < length && !seen.has(n)) {
      order.push(n);
      seen.add(n);
    }
  }
  for (let i = 0; i < length; i++) {
    if (!seen.has(i)) order.push(i);
  }
  return order;
}

// Apify returns the newest posts. Likes decide which of that window is seen first.
export function rankPostsByLikes(posts: InstagramPost[]): string[] {
  return posts
    .filter((post): post is InstagramPost & { displayUrl: string } =>
      typeof post.displayUrl === "string" && post.displayUrl.startsWith("https://")
    )
    .sort((a, b) => (likesOf(b.likesCount) - likesOf(a.likesCount)))
    .map((post) => post.displayUrl);
}

function likesOf(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function instagramHandle(url: string | null | undefined): string | null {
  const match = /instagram\.com\/([^/?#]+)/i.exec(url ?? "");
  if (!match) return null;
  const handle = match[1].replace(/^@/, "").trim();
  if (!handle) return null;
  if (new Set(["p", "reel", "reels", "explore", "stories", "tv"]).has(handle.toLowerCase())) return null;
  return handle;
}

export async function fetchInstagramPosts(opts: {
  instagramUrl: string | null;
  depth: number;
  apifyKey?: string;
  fetchImpl?: FetchImpl;
}): Promise<InstagramPost[]> {
  const handle = instagramHandle(opts.instagramUrl);
  const key = opts.apifyKey?.trim() ?? "";
  const depth = clamp(opts.depth, INSTAGRAM_CAP);
  if (!handle || !key || depth <= 0) return [];
  const fetchImpl = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetchImpl(
      `https://api.apify.com/v2/acts/apify~instagram-post-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: [handle], resultsLimit: depth, skipPinnedPosts: true }),
        signal: ctrl.signal,
      },
    );
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 200);
      console.error(`[images] apify ${res.status} ${body}`);
      return [];
    }
    const data = await res.json();
    const posts = Array.isArray(data) ? data as InstagramPost[] : [];
    charge("apify", posts.length * APIFY_USD.instagramPost, `instagram-post-scraper ${posts.length} posts`);
    return posts;
  } catch (err) {
    const why = ctrl.signal.aborted
      ? "timeout after 60000ms"
      : (err instanceof Error ? err.message : String(err)).slice(0, 200);
    console.error(`[images] apify ${why}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export type PhotoAnalysis = {
  url: string;
  source: "google" | "instagram";
  text: string;
};

export type GalleryRank = {
  urls: string[];
  analyses: PhotoAnalysis[];
};

export async function rankGallery(opts: {
  google: string[];
  instagram: string[];
  knobs: ImageKnobs;
  openaiKey?: string;
  fetchImpl?: FetchImpl;
}): Promise<GalleryRank> {
  const knobs = opts.knobs;
  const keep = clamp(knobs.saveTotalImages, GALLERY_CAP);
  const google = httpsOnly(opts.google).slice(0, clamp(knobs.gatherGoogleImages, GOOGLE_CAP));
  const instagram = httpsOnly(opts.instagram);
  const googleSet = new Set(google);
  const photos = dedupe(knobs.visionEnabled
    ? [
      ...google.slice(0, clamp(knobs.analyzeGoogleImages, google.length)),
      ...instagram.slice(0, clamp(knobs.analyzeInstagramImages, instagram.length)),
    ]
    : [...google, ...instagram]);
  if (keep <= 0) return { urls: [], analyses: [] };
  const kept = photos.slice(0, keep);
  const key = opts.openaiKey?.trim() ?? "";
  if (!knobs.visionEnabled || photos.length === 0 || !key) return { urls: kept, analyses: [] };
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const descriptions = await describePhotos(fetchImpl, key, photos, knobs);
    if (!descriptions || descriptions.every((line) => !line)) return { urls: kept, analyses: [] };
    const order = await rankPhotos(fetchImpl, key, descriptions, knobs);
    const urls = order ? applyPhotoOrder(photos, order, keep) : kept;
    const saved = new Set(urls);
    const analyses: PhotoAnalysis[] = [];
    for (let i = 0; i < photos.length; i++) {
      const text = (descriptions[i] ?? "").trim();
      const url = photos[i];
      if (!text || !url || !saved.has(url)) continue;
      analyses.push({
        url,
        source: googleSet.has(url) ? "google" : "instagram",
        text,
      });
    }
    return { urls, analyses };
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    console.error(`[images] ${why.slice(0, 200)}`);
    return { urls: kept, analyses: [] };
  }
}

function httpsOnly(urls: string[]): string[] {
  return urls.filter((url) => url.startsWith("https://"));
}

function dedupe(urls: string[]): string[] {
  const out: string[] = [];
  for (const url of urls) {
    if (!out.includes(url)) out.push(url);
  }
  return out;
}

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.floor(value)));
}

async function describePhotos(
  fetchImpl: FetchImpl,
  apiKey: string,
  urls: string[],
  knobs: ImageKnobs,
): Promise<string[] | null> {
  const descriptions = await Promise.all(urls.map((url) => describeOne(fetchImpl, apiKey, url, knobs)));
  return descriptions.every((line) => !line) ? null : descriptions;
}

async function describeOne(
  fetchImpl: FetchImpl,
  apiKey: string,
  url: string,
  knobs: ImageKnobs,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: knobs.visionModel,
        temperature: 0,
        max_tokens: 200,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: knobs.imageAnalysisPrompt },
            { type: "image_url", image_url: { url, detail: "low" } },
          ],
        }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return "";
    const body = await res.json() as ChatBody;
    charge("openai", openaiUsd(knobs.visionModel, body.usage), `vision ${knobs.visionModel}`);
    return (body.choices?.[0]?.message?.content ?? "").trim();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function rankPhotos(
  fetchImpl: FetchImpl,
  apiKey: string,
  descriptions: string[],
  knobs: ImageKnobs,
): Promise<unknown> {
  const list = descriptions.map((line, index) => `${index}: ${line || "(no description)"}`).join("\n");
  const res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: knobs.sortModel,
      temperature: 0,
      messages: [{
        role: "user",
        content:
          `${knobs.imageSortingPrompt}\n\nImages (index: description):\n${list}\n\n` +
          'Return a SINGLE JSON object {"order": [indices best-to-worst]}. ' +
          "Include EVERY index exactly once; do not drop any. No prose, no fences.",
      }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return null;
  const body = await res.json() as ChatBody;
  charge("openai", openaiUsd(knobs.sortModel, body.usage), `sort ${knobs.sortModel}`);
  const text = body.choices?.[0]?.message?.content ?? "";
  try {
    return (JSON.parse(text) as { order?: unknown }).order ?? null;
  } catch {
    return null;
  }
}
