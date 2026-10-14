// Search vectors for the one write. The literal is what pgvector stores.
// A short or missing vector is omitted; it does not reject the place.

export const EMBEDDING_DIMS = 1536;
export const EMBEDDING_MODEL = "text-embedding-3-small";

export function embeddingFacts(place: {
  name: string;
  zone?: string | null;
  city?: string | null;
  address?: string | null;
  description?: string | null;
}): string {
  const lines = [`Name: ${place.name}`];
  const where = [place.zone, place.city].filter(Boolean).join(", ");
  if (where) lines.push(`Location: ${where}`);
  if (place.address) lines.push(`Address: ${place.address}`);
  const about = place.description?.trim() ?? "";
  if (about) lines.push(`About: ${about.slice(0, 900)}`);
  return lines.join("\n");
}

export function vectorLiteral(values: number[]): string {
  return `[${values.map((value) => value.toFixed(6)).join(",")}]`;
}

export async function digest(text: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export function embeddingFields(
  summary: number[] | null,
  name: number[] | null,
  summaryHash: string,
  nameHash: string,
  summaryText: string,
): Record<string, string> | null {
  if (!summary || summary.length !== EMBEDDING_DIMS) return null;
  const patch: Record<string, string> = {
    embedding: vectorLiteral(summary),
    embedding_source_hash: summaryHash,
    embedding_source_text: summaryText,
  };
  if (name && name.length === EMBEDDING_DIMS) {
    patch.name_embedding = vectorLiteral(name);
    patch.name_embedding_hash = nameHash;
  }
  return patch;
}

export async function embedPair(
  summary: string,
  name: string,
  apiKey: string,
): Promise<{ summary: number[] | null; name: number[] | null }> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: [summary, name] }),
  });
  const body = await res.json().catch(() => null) as {
    data?: { embedding?: number[]; index?: number }[];
  } | null;
  if (!res.ok || !body?.data) return { summary: null, name: null };
  const byIndex = new Map(body.data.map((row) => [row.index, row.embedding ?? null]));
  return { summary: byIndex.get(0) ?? null, name: byIndex.get(1) ?? null };
}
