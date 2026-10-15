// Render talks to one Edge Function. It does not open the database.

const WRITE_FUNCTION = "enricher-edgefunc-write-place";

export function writePlaceUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${WRITE_FUNCTION}`;
}

export async function writeFinishedPlace(
  placeId: string,
  patch: Record<string, unknown>,
  mirrorPhotos = true,
): Promise<{ placeId: string }> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const writeKey = process.env.ENRICH_WRITE_KEY?.trim() ?? "";
  if (!supabaseUrl || !writeKey) {
    throw new Error("Render is missing SUPABASE_URL or ENRICH_WRITE_KEY");
  }
  const res = await fetch(writePlaceUrl(supabaseUrl), {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${writeKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ placeId, patch, mirrorPhotos }),
  });
  const body = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !body?.ok) {
    throw new Error(body?.error || `write place failed (${res.status})`);
  }
  return { placeId };
}

// Sent before a failed task exits. The function turns enriching off. A
// failure here must not replace the error that failed the run.
export function stopEnrichingBody(placeId: string): { placeId: string; stop: true } {
  return { placeId, stop: true };
}

export async function stopEnriching(placeId: string): Promise<void> {
  const id = placeId.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const writeKey = process.env.ENRICH_WRITE_KEY?.trim() ?? "";
  if (!id || !supabaseUrl || !writeKey) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(writePlaceUrl(supabaseUrl), {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${writeKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stopEnrichingBody(id)),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      console.error(`[enrich] stop enriching failed: ${body?.error || res.status}`);
    }
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    console.error(`[enrich] stop enriching failed: ${why}`);
  } finally {
    clearTimeout(timer);
  }
}
