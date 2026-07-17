// Pure embedding + ranking helpers (no HTTP / DB).
// Orchestration and OpenAI calls stay in embeddings.ts.

// Structural type satisfied by every EF's PlaceRow definition. Only the
// fields used for source-text + persistence are required; readers may carry
// arbitrary extra columns.
export type EmbeddablePlace = {
  id: string;
  name: string;
  category: string | null;
  vibe: string | null;
  pitch: string | null;
  story: string | null;
  address: string | null;
  price_level: number | null;
  embedding: unknown | null;
  embedding_source_hash: string | null;
};

// Stable source text we feed to the embedder. Order matters — name first so
// the model anchors on identity, then the soft descriptors. Story is hard-
// capped so a freakishly long story can't dominate the embedding budget.
export function placeSourceText(v: EmbeddablePlace): string {
  const lines: string[] = [];
  lines.push(`Name: ${v.name}`);
  if (v.category) lines.push(`Category: ${v.category}`);
  if (v.vibe) lines.push(`Vibe: ${v.vibe}`);
  if (v.pitch) lines.push(`Pitch: ${v.pitch}`);
  if (v.story) lines.push(`Story: ${v.story.slice(0, 700)}`);
  if (v.address) lines.push(`Address: ${v.address}`);
  if (v.price_level != null) lines.push(`Price level: ${v.price_level}/4`);
  return lines.join("\n");
}

// Cheap stable hash of the source text so we can detect "this place's text
// changed, re-embed" without storing the whole text alongside the embedding.
export async function digest(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export function shouldEmbed(v: EmbeddablePlace): boolean {
  if (!v.embedding) return true;
  return v.embedding_source_hash == null;
}

// pgvector accepts vectors as text literals like "[0.01,0.02,...]". We build
// that here so the .update() call sends a plain string (supabase-js doesn't
// have a vector binder).
export function vectorLiteral(v: number[]): string {
  return `[${v.map((x) => x.toFixed(6)).join(",")}]`;
}

// pgvector via supabase-js may arrive already typed when a row was patched
// locally from an embed call; otherwise it's the "[a,b,c]" text literal.
export function parseVector(v: unknown): number[] | null {
  if (Array.isArray(v)) return v as number[];
  if (typeof v !== "string") return null;
  const inner = v.slice(v.startsWith("[") ? 1 : 0, v.endsWith("]") ? -1 : undefined);
  if (!inner) return null;
  const arr = inner.split(",").map((s) => Number(s));
  for (const n of arr) if (!Number.isFinite(n)) return null;
  return arr;
}

// text-embedding-3-small returns unit-length vectors, so dot product is
// already the cosine.
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot;
}

export function rankByCosine<T extends { embedding: unknown }>(
  rows: T[],
  queryVec: number[],
): T[] {
  const scored = rows.map((r) => {
    const v = parseVector(r.embedding);
    const score = v ? cosineSim(v, queryVec) : -1; // no embedding → tail
    return { row: r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.row);
}
