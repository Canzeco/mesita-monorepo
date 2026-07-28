// On-Update place embeddings (MESITA-720).
//
// Enricher On-Update S2/S3 contract:
//   1. Read place profile fields (never tags)
//   2. Synthesize a short human blurb (LLM; deterministic facts fallback)
//   3. Embed with text-embedding-3-small and persist text + hash + vector
//
// Called after enrich-contents publish and after business-web-update-project
// when embedding-relevant fields change. The recommender lazy path also uses
// synthesizePlaceEmbeddingText via embedAndPersistPlaces.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type EmbeddablePlace,
  digest,
  placeEmbeddingFacts,
  vectorLiteral,
} from "./embeddings-vector.ts";
import { OPENAI_URL } from "./enrich-config.ts";

const SYNTH_MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const MAX_BLURB_CHARS = 420;

async function embedBlurb(text: string, apiKey: string): Promise<number[]> {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!r.ok) throw new Error(`embed HTTP ${r.status}`);
  const data = (await r.json()) as { data?: { embedding: number[] }[] };
  const v = data.data?.[0]?.embedding;
  if (!v || v.length !== EMBEDDING_DIMS) throw new Error("embed: bad shape");
  return v;
}

const EMBEDDING_RELEVANT_KEYS = [
  "name",
  "category",
  "description",
  "zone",
  "city",
  "address",
  "price_level",
] as const;

export function updateTouchesEmbeddingInputs(
  update: Record<string, unknown>,
): boolean {
  return EMBEDDING_RELEVANT_KEYS.some((k) => k in update);
}

export function composeEmbeddingBlurb(v: EmbeddablePlace): string {
  const cat = v.category ? v.category.replace(/_/g, " ") : null;
  const where = [v.zone, v.city].filter(Boolean).join(", ");
  const head = [v.name, cat ? `a ${cat}` : null, where || null]
    .filter(Boolean)
    .join(" — ");
  const about = (v.description ?? "").trim().replace(/\s+/g, " ");
  if (!about) return head.slice(0, MAX_BLURB_CHARS);
  // First ~2 sentences of About, capped.
  const sentences = about.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [about];
  const body = sentences.slice(0, 2).join(" ");
  return `${head}. ${body}`.replace(/\s+/g, " ").trim().slice(0, MAX_BLURB_CHARS);
}

export async function synthesizePlaceEmbeddingText(
  v: EmbeddablePlace,
  apiKey: string,
): Promise<string> {
  const facts = placeEmbeddingFacts(v);
  if (!facts.trim()) return composeEmbeddingBlurb(v);

  try {
    const r = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: SYNTH_MODEL,
        temperature: 0,
        max_tokens: 160,
        messages: [
          {
            role: "system",
            content:
              "You write a short place blurb for semantic search embeddings. " +
              "Output 1–3 sentences, plain text only — no labels, no bullets, no tags. " +
              "Capture what the place IS (cuisine/format), where it is, and the vibe from About. " +
              "Never invent facts not present in the input. Never list amenity tags.",
          },
          {
            role: "user",
            content: `Write the embedding blurb for this place:\n\n${facts}`,
          },
        ],
      }),
    });
    if (!r.ok) {
      console.error("[place-embeddings] synth HTTP", r.status, (await r.text()).slice(0, 200));
      return composeEmbeddingBlurb(v);
    }
    const data = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return composeEmbeddingBlurb(v);
    return text.replace(/\s+/g, " ").slice(0, MAX_BLURB_CHARS);
  } catch (err) {
    console.error("[place-embeddings] synth exception:", err);
    return composeEmbeddingBlurb(v);
  }
}

export type PlaceEmbeddingWrite = {
  embedding: number[];
  hash: string;
  text: string;
  skipped: boolean;
};

// On-Update S2+S3 for one place. Skips when facts digest matches the stored
// embedding_source_hash and both text + vector are present.
async function computeAndPersistPlaceEmbedding(
  admin: SupabaseClient,
  place: EmbeddablePlace,
  apiKey: string,
  logPrefix = "place-embeddings",
): Promise<PlaceEmbeddingWrite | null> {
  const facts = placeEmbeddingFacts(place);
  const factsHash = await digest(facts);

  if (
    place.embedding &&
    place.embedding_source_text?.trim() &&
    place.embedding_source_hash === factsHash
  ) {
    return {
      embedding: [],
      hash: factsHash,
      text: place.embedding_source_text.trim(),
      skipped: true,
    };
  }

  const text = await synthesizePlaceEmbeddingText(place, apiKey);
  let vector: number[];
  try {
    vector = await embedBlurb(text, apiKey);
  } catch (err) {
    console.error(`[${logPrefix}] embed failed:`, err);
    return null;
  }
  if (vector.length !== EMBEDDING_DIMS) {
    console.error(`[${logPrefix}] bad dims ${vector.length}`);
    return null;
  }

  const { error } = await admin
    .from("projects_view")
    .update({
      embedding: vectorLiteral(vector),
      embedding_source_hash: factsHash,
      embedding_source_text: text,
    })
    .eq("id", place.id);

  if (error) {
    console.error(`[${logPrefix}] write:`, error.message);
    return null;
  }

  return { embedding: vector, hash: factsHash, text, skipped: false };
}

async function loadEmbeddablePlace(
  admin: SupabaseClient,
  placeId: string,
): Promise<EmbeddablePlace | null> {
  const { data, error } = await admin
    .from("projects_view")
    .select(
      "id, name, category, description, zone, city, address, price_level, embedding, embedding_source_hash, embedding_source_text",
    )
    .eq("id", placeId)
    .maybeSingle();
  if (error) {
    console.error("[place-embeddings] load:", error.message);
    return null;
  }
  return (data as EmbeddablePlace | null) ?? null;
}

export async function runPlaceEmbeddingsOnUpdate(
  admin: SupabaseClient,
  placeId: string,
  apiKey: string | undefined,
  logPrefix = "place-embeddings",
): Promise<PlaceEmbeddingWrite | null> {
  if (!apiKey) {
    console.error(`[${logPrefix}] OPENAI_KEY missing — skip`);
    return null;
  }
  const place = await loadEmbeddablePlace(admin, placeId);
  if (!place?.name) {
    console.error(`[${logPrefix}] place not found:`, placeId);
    return null;
  }
  return computeAndPersistPlaceEmbedding(admin, place, apiKey, logPrefix);
}

export function queuePlaceEmbeddingsOnUpdate(opts: {
  admin: SupabaseClient;
  placeId: string;
  apiKey: string | undefined;
  logPrefix?: string;
}): void {
  const task = runPlaceEmbeddingsOnUpdate(
    opts.admin,
    opts.placeId,
    opts.apiKey,
    opts.logPrefix,
  ).catch((err) => {
    console.error(`[${opts.logPrefix ?? "place-embeddings"}] bg:`, err);
  });
  const edgeRuntime = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(task);
  else void task;
}
