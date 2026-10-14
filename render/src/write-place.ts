// Render talks to one Edge Function. It does not open the database.

const WRITE_FUNCTION = "enricher-edgefunc-write-place";

export function writePlaceUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${WRITE_FUNCTION}`;
}

export async function writeFinishedPlace(
  placeId: string,
  patch: Record<string, unknown>,
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
    body: JSON.stringify({ placeId, patch }),
  });
  const body = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !body?.ok) {
    throw new Error(body?.error || `write place failed (${res.status})`);
  }
  return { placeId };
}
