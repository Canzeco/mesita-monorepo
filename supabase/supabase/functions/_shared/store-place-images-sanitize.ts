// Pure sanitizers / URL helpers for place-image persistence.
// Extracted from store-place-images.ts (no I/O).

const MAX_ASSETS = 120;

export type SourceKind = "google" | "website" | "instagram";

export type PlaceImageAssetInput = {
  source?: SourceKind;
  source_url?: string;
  likes_count?: number | null;
  caption?: string | null;
  analysis?: string | null;
  source_metadata?: Record<string, unknown> | null;
};

export type AssetRow = {
  source: SourceKind;
  source_url: string;
  likes_count: number | null;
  caption: string | null;
  analysis_text: string | null;
  source_metadata: Record<string, unknown> | null;
};

export function sanitiseAssets(input: PlaceImageAssetInput[] | undefined): AssetRow[] {
  if (!Array.isArray(input)) return [];
  const out: AssetRow[] = [];
  const seen = new Set<string>();
  for (const row of input) {
    if (!row || typeof row !== "object") continue;
    const source = row.source;
    const sourceUrl = typeof row.source_url === "string" ? row.source_url.trim() : "";
    if (!source || !isSource(source) || !isHttpUrl(sourceUrl) || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    out.push({
      source,
      source_url: sourceUrl,
      likes_count: toNullableInt(row.likes_count),
      caption: optText(row.caption, 2000),
      analysis_text: optText(row.analysis, 4000),
      source_metadata:
        row.source_metadata && typeof row.source_metadata === "object" && !Array.isArray(row.source_metadata)
          ? (row.source_metadata as Record<string, unknown>)
          : null,
    });
    if (out.length >= MAX_ASSETS) break;
  }
  return out;
}

export function sanitiseUrls(input: string[]): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const url = typeof raw === "string" ? raw.trim() : "";
    if (!isHttpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function isSource(v: string): v is SourceKind {
  return v === "google" || v === "website" || v === "instagram";
}

function toNullableInt(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.max(0, Math.trunc(v));
}

function optText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function extFor(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("avif")) return "avif";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

export function imageIdFromPath(path: string): string | null {
  const filename = path.split("/").pop() ?? "";
  const candidate = filename.includes(".")
    ? filename.slice(0, filename.lastIndexOf("."))
    : filename;
  if (/^[a-f0-9]{64}$/i.test(candidate)) return candidate.toLowerCase();
  return null;
}
