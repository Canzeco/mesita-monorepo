// Enrichment calls the same Sync edge function the Reviews button uses.
// The result stays in the draft until the one profile commit.

export type DraftLinks = {
  googlePlaceId: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
};

export async function fetchDraftSync(
  links: DraftLinks,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const writeKey = process.env.ENRICH_WRITE_KEY?.trim() ?? "";
  if (!supabaseUrl || !writeKey) {
    return errorPatch("Sync is not configured");
  }
  try {
    const res = await fetchImpl(
      `${supabaseUrl.replace(/\/$/, "")}/functions/v1/enricher-edgefunc-sync-sources`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${writeKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(links),
      },
    );
    const body = await res.json().catch(() => null) as { ok?: boolean; patch?: Record<string, unknown> } | null;
    if (!res.ok || !body?.ok || !body.patch) return errorPatch("Sync did not return a result");
    return body.patch;
  } catch {
    return errorPatch("Sync did not respond");
  }
}

function errorPatch(error: string): Record<string, unknown> {
  const sources = ["google", "instagram", "facebook", "google_reviews"].map((source) => ({
    source,
    status: "error",
    error,
  }));
  return { source_sync: { lastSyncedAt: new Date().toISOString(), sources } };
}
