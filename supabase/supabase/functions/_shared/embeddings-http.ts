// Low-level OpenAI embeddings HTTP — shared by embeddings.ts (lazy RAG path)
// and place-embeddings.ts (On-Update path) so model/dims/request shape cannot
// drift. No DB imports; safe for either side of the synth↔embed cycle.
// Default model string mirrors models_config.embeddings.model (MESITA-941/943,
// key renamed off `lineup` in MESITA-1216).

import { DEFAULT_MODELS_CONFIG } from "./models-config.ts";

export const DEFAULT_EMBEDDING_MODEL = DEFAULT_MODELS_CONFIG.embeddings.model!;
export const EMBEDDING_DIMS = 1536;

export function callEmbeddings(
  input: string | string[],
  apiKey: string,
  model = DEFAULT_EMBEDDING_MODEL,
): Promise<Response> {
  return fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input }),
  });
}

export async function embedSingle(
  text: string,
  apiKey: string,
  model = DEFAULT_EMBEDDING_MODEL,
): Promise<number[]> {
  const r = await callEmbeddings(text, apiKey, model);
  if (!r.ok) throw new Error(`embed HTTP ${r.status}`);
  const data = (await r.json()) as { data?: { embedding: number[] }[] };
  const v = data.data?.[0]?.embedding;
  if (!v || v.length !== EMBEDDING_DIMS) throw new Error("embed: bad shape");
  return v;
}

export async function embedBatch(
  texts: string[],
  apiKey: string,
  model = DEFAULT_EMBEDDING_MODEL,
): Promise<number[][]> {
  const r = await callEmbeddings(texts, apiKey, model);
  if (!r.ok) throw new Error(`embedBatch HTTP ${r.status}`);
  const data = (await r.json()) as {
    data?: { embedding: number[]; index: number }[];
  };
  const out: number[][] = new Array(texts.length);
  for (const d of data.data ?? []) out[d.index] = d.embedding;
  return out;
}
