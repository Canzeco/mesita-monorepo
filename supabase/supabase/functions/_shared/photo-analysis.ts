// Vision text for the photos a Full run kept. The gallery order is best to
// worst. The text stays on the photo after the file is copied into storage.

export type PhotoAnalysis = {
  url: string;
  source: "google" | "instagram";
  text: string;
};

export type StoredPhoto = {
  sourceUrl: string;
  publicUrl: string;
};

export type SavedAnalysis = {
  sourceUrl: string;
  publicUrl: string;
  source: "google" | "instagram";
  text: string;
};

const TEXT_MAX = 4000;
const CAP = 10;

export function readPhotoAnalyses(value: unknown): PhotoAnalysis[] {
  if (!Array.isArray(value)) return [];
  const out: PhotoAnalysis[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as { url?: unknown; source?: unknown; text?: unknown };
    const url = typeof row.url === "string" ? row.url.trim() : "";
    const text = typeof row.text === "string" ? row.text.trim().slice(0, TEXT_MAX) : "";
    const source = row.source === "instagram" ? "instagram" : row.source === "google" ? "google" : "";
    if (!url.startsWith("https://") || !text || !source || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, source, text });
    if (out.length === CAP) break;
  }
  return out;
}

/** Attach each description to the URL the gallery actually stores. */
export function pairedAnalyses(stored: StoredPhoto[], analyses: PhotoAnalysis[]): SavedAnalysis[] {
  const byUrl = new Map(analyses.map((row) => [row.url, row]));
  const out: SavedAnalysis[] = [];
  for (const photo of stored) {
    const found = byUrl.get(photo.sourceUrl);
    if (!found) continue;
    out.push({
      sourceUrl: photo.sourceUrl,
      publicUrl: photo.publicUrl,
      source: found.source,
      text: found.text,
    });
  }
  return out;
}

/** Keys are the URLs a gallery tile can hold: the stored file, or the source. */
export function photoAnalysisMap(rows: unknown): Record<string, string> {
  if (!Array.isArray(rows)) return {};
  const map: Record<string, string> = {};
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as { public_url?: unknown; source_url?: unknown; analysis_text?: unknown };
    const text = typeof row.analysis_text === "string" ? row.analysis_text.trim() : "";
    if (!text) continue;
    if (typeof row.source_url === "string" && row.source_url) map[row.source_url] = text;
    if (typeof row.public_url === "string" && row.public_url) map[row.public_url] = text;
  }
  return map;
}
