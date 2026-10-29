// On-Update place embeddings (MESITA-720).
//
// Enricher On-Update S2/S3 contract:
//   1. Read place profile fields (never tags)
//   2. Synthesize a short human blurb (LLM; deterministic facts fallback)
//   3. Embed with text-embedding-3-small and persist text + vector
//
// §8.4 v3 (2026-08-29): the WORDS belong to the Description function; the
// Embedding function only embeds what Description wrote.
//   · computeAndPersistPlaceEmbedding mode "stored" — embed-only: embeds the
//     STORED summary text; never synthesizes. (MESITA-2900: the name vector
//     is gone — Google's name is canonical.)
//   · mode "synth" — the on-update path (profile edits): Description's
//     synthesis helper then the embed, composed in one call.
// Called by Create (create-place.ts, mode "stored") and by
// admin-web-update-place when embedding-relevant fields change.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { runInBackground } from "./background.ts";
import {
  type EmbeddablePlace,
  placeEmbeddingFacts,
  vectorLiteral,
} from "./embeddings-vector.ts";
import {
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_DIMS,
  embedSingle,
} from "./embeddings-http.ts";
import { openaiChat } from "./enrich-config.ts";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";
import { DEFAULT_MODELS_CONFIG, loadModelsConfig } from "./models-config.ts";
import { writePlace, type PlaceProfilePatch } from "./place-doc.ts";
import { stepDone, reportCrenupSteps } from "./crenup-report.ts";

/** Fallback when models_config.enricher.model is unset. */
const DEFAULT_SYNTH_MODEL = DEFAULT_MODELS_CONFIG.enricher.model;
/** Hard ceiling for the Semantic Summary — Atlas Config Field limits. */
export const MAX_BLURB_WORDS = ENRICH_FIELD_LIMITS.embeddingSourceText.max;

/** Normalize whitespace and clamp to a word count (never mid-word). */
export function clampToWordLimit(text: string, maxWords = MAX_BLURB_WORDS): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const words = normalized.split(" ");
  if (words.length <= maxWords) return normalized;
  return words.slice(0, maxWords).join(" ");
}

export function countWords(text: string): number {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return 0;
  return normalized.split(" ").length;
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
  if (!about) return clampToWordLimit(head);
  // First ~2 sentences of About, then word-cap.
  const sentences = about.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [about];
  const body = sentences.slice(0, 2).join(" ");
  return clampToWordLimit(`${head}. ${body}`);
}

export async function synthesizePlaceEmbeddingText(
  v: EmbeddablePlace,
  apiKey: string,
  synthModel = DEFAULT_SYNTH_MODEL,
): Promise<string> {
  const facts = placeEmbeddingFacts(v);
  if (!facts.trim()) return composeEmbeddingBlurb(v);

  const res = await openaiChat({
    key: apiKey,
    model: synthModel,
    temperature: 0,
    maxTokens: 160,
    messages: [
      {
        role: "system",
        content:
          "You write a short place blurb for semantic search embeddings. " +
          `Output 1–3 sentences, at most ${MAX_BLURB_WORDS} words, plain text only — no labels, no bullets, no tags. ` +
          "Capture what the place IS (cuisine/format), where it is, and the vibe from About. " +
          "Never invent facts not present in the input. Never list amenity tags. " +
          "Finish on a complete word — never truncate mid-word.",
      },
      {
        role: "user",
        content: `Write the embedding blurb (≤${MAX_BLURB_WORDS} words) for this place:\n\n${facts}`,
      },
    ],
  });
  if (!res.ok) {
    if (res.status !== null) {
      console.error("[place-embeddings] synth HTTP", res.status, (res.errorBody ?? "").slice(0, 200));
    } else {
      console.error("[place-embeddings] synth exception:", res.error);
    }
    return composeEmbeddingBlurb(v);
  }
  const text = res.content.trim();
  if (!text) return composeEmbeddingBlurb(v);
  return clampToWordLimit(text);
}

export type PlaceEmbeddingWrite = {
  embedding: number[];
  text: string;
};

/**
 * Who asked for this embed — stamped onto the summary event so the Monitor can
 * attribute the beacon to the right caller instead of guessing from the key
 * (MESITA-1253 audit): "create" = the front door, "update" = a profile edit
 * re-embedding in-process.
 */
export type EmbeddingVia = "create" | "update";

// On-Update S2+S3 for one place. Every run regenerates the summary vector —
// even if its text is unchanged.
async function computeAndPersistPlaceEmbedding(
  admin: SupabaseClient,
  place: EmbeddablePlace,
  apiKey: string,
  logPrefix = "place-embeddings",
  via: EmbeddingVia = "update",
  mode: "synth" | "stored" = "synth",
): Promise<PlaceEmbeddingWrite | null> {
  const models = await loadModelsConfig(admin);
  const model = models.embeddingModel || DEFAULT_EMBEDDING_MODEL;
  const patch: PlaceProfilePatch = {};
  let text = place.embedding_source_text?.trim() ?? "";

  if (mode === "stored") {
    // Embed-only (§8.4 v3): the Embedding function never writes words.
    // No stored summary means Description has not run — report and let
    // the stage stamp the honest failure.
    if (!text) {
      console.error(
        `[${logPrefix}] no embedding_source_text — Description pending`,
      );
      return null;
    }
  } else {
    text = await synthesizePlaceEmbeddingText(
      place,
      apiKey,
      models.enricherModel || DEFAULT_SYNTH_MODEL,
    );
  }
  let vector: number[];
  try {
    vector = await embedSingle(text, apiKey, model);
  } catch (err) {
    console.error(`[${logPrefix}] embed failed:`, err);
    return null;
  }
  if (vector.length !== EMBEDDING_DIMS) {
    console.error(`[${logPrefix}] bad dims ${vector.length}`);
    return null;
  }
  patch.embedding = vectorLiteral(vector);
  if (mode !== "stored") patch.embedding_source_text = text;

  const writeRes = await writePlace(admin, {
    table: "profiles",
    mode: "update",
    id: place.id,
    patch,
  });

  if (!writeRes.ok) {
    console.error(`[${logPrefix}] write:`, writeRes.error);
    return null;
  }

  // ── EMBEDDING stamp ─────────────────────────────────────────────────────
  // `via` names the caller so the Monitor attributes the beacon.
  await reportCrenupSteps(admin, place.id, {
    embedding: stepDone(`Semantic Summary embedded — ${countWords(text)} word(s).`, { via }),
  });

  return { embedding: vector, text };
}

async function loadEmbeddablePlace(
  admin: SupabaseClient,
  placeId: string,
): Promise<EmbeddablePlace | null> {
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, name, category, description, zone, city, address, price_level, embedding, embedding_source_text",
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
  via: EmbeddingVia = "update",
  mode: "synth" | "stored" = "synth",
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
  return computeAndPersistPlaceEmbedding(admin, place, apiKey, logPrefix, via, mode);
}

export function queuePlaceEmbeddingsOnUpdate(opts: {
  admin: SupabaseClient;
  placeId: string;
  apiKey: string | undefined;
  logPrefix?: string;
  via?: EmbeddingVia;
}): void {
  const task = runPlaceEmbeddingsOnUpdate(
    opts.admin,
    opts.placeId,
    opts.apiKey,
    opts.logPrefix,
    opts.via,
  ).catch((err) => {
    console.error(`[${opts.logPrefix ?? "place-embeddings"}] bg:`, err);
  });
  runInBackground(task);
}
