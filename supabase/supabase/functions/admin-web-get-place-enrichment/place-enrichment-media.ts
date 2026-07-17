export type MediaRow = {
  public_url: string | null;
  source: string | null;
  status: string | null;
  analysis_text: string | null;
  caption: string | null;
  likes_count: number | null;
  source_url: string | null;
  source_metadata: Record<string, unknown> | null;
};

// What the client sees per photo. `position`/`total` are filled in the browser
// from the gallery order — the DB stores no rank, the array order IS the rank.
export type MediaMeta = Omit<MediaRow, "public_url">;

// Keyed by BOTH public_url and source_url so the client resolves a gallery
// photo whether places.photos[] holds the mirrored URL or (mirror failed) the
// raw source URL. public_url wins on collision — it's the canonical stored key.
export function indexMediaByUrl(rows: MediaRow[]): Record<string, MediaMeta> {
  const media: Record<string, MediaMeta> = {};
  for (const r of rows) {
    const meta: MediaMeta = {
      source: r.source,
      status: r.status,
      analysis_text: r.analysis_text,
      caption: r.caption,
      likes_count: r.likes_count,
      source_url: r.source_url,
      source_metadata: r.source_metadata,
    };
    if (r.source_url && !media[r.source_url]) media[r.source_url] = meta;
    if (r.public_url) media[r.public_url] = meta;
  }
  return media;
}
