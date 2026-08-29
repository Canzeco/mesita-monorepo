// On-Update place embeddings (MESITA-720).
//
// Intaker On-Update S2/S3 contract:
//   1. Read place profile fields (never tags)
//   2. Synthesize a short human blurb (LLM; deterministic facts fallback)
//   3. Embed with text-embedding-3-small and persist text + hash + vector
//
// §8.4 v3 (2026-08-29): the WORDS belong to the Description function; the
// Embedding function only embeds what Description wrote.
//   · synthesizePlaceSummaryText — Description-owned: synthesizes the
//     Semantic Summary when the facts digest moved; never embeds.
//   · computeAndPersistPlaceEmbedding mode "stored" — embed-only: embeds the
//     STORED summary text + the name; never synthesizes. The facts hash is
//     stamped HERE, at embed time, so a Description-then-Embedding split can
//     never hash-skip a stale vector (the hash only matches once the vector
//     of the current text landed).
//   · mode "synth" — the on-update path (profile edits): Description's
//     synthesis helper then the embed, composed in one call.
// Called after enrich-contents publish and after business-web-update-project
// when embedding-relevant fields change.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type EmbeddablePlace,
  digest,
  placeEmbeddingFacts,
  placeNameEmbedText,
  vectorLiteral,
} from "./embeddings-vector.ts";
import {
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_DIMS,
  embedSingle,
} from "./embeddings-http.ts";
import { OPENAI_URL } from "./enrich-config.ts";
import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";
import { DEFAULT_MODELS_CONFIG, loadModelsConfig } from "./models-config.ts";
import { writePlace, type PlacePatch } from "./place-doc.ts";
import { pieceDone, reportPulsePieces } from "./pulse-report.ts";

/** Fallback when models_config.enricher.model is unset. */
const DEFAULT_SYNTH_MODEL = DEFAULT_MODELS_CONFIG.enricher.model!;
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

/**
 * Description-owned Semantic Summary. Returns the stored text untouched when
 * the facts digest matches (`fresh: true`); otherwise synthesizes a new one.
 * NEVER persists and NEVER stamps `embedding_source_hash` — the hash belongs
 * to the Embedding step (stamped only once the vector of this text landed).
 */
export async function synthesizePlaceSummaryText(
  admin: SupabaseClient,
  place: EmbeddablePlace,
  apiKey: string,
): Promise<{ text: string; fresh: boolean }> {
  const factsHash = await digest(placeEmbeddingFacts(place));
  const stored = place.embedding_source_text?.trim() ?? "";
  if (stored && place.embedding_source_hash === factsHash) {
    return { text: stored, fresh: true };
  }
  const models = await loadModelsConfig(admin);
  const text = await synthesizePlaceEmbeddingText(
    place,
    apiKey,
    models.enricherModel || DEFAULT_SYNTH_MODEL,
  );
  return { text, fresh: false };
}

export async function synthesizePlaceEmbeddingText(
  v: EmbeddablePlace,
  apiKey: string,
  synthModel = DEFAULT_SYNTH_MODEL,
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
        model: synthModel,
        temperature: 0,
        max_tokens: 160,
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
    return clampToWordLimit(text);
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
  nameSkipped: boolean;
};

/**
 * Who asked for this embed — stamped onto the summary event so the Monitor can
 * attribute the beacon to the right caller instead of guessing from the key
 * (MESITA-1253 audit): "create" = the front door, "update" = a profile edit
 * re-embedding in-process, "contents" = the enrich stage.
 */
export type EmbeddingVia = "create" | "update" | "contents";

// On-Update S2+S3 for one place. Skips when facts digest matches the stored
// embedding_source_hash and both text + vector are present.
async function computeAndPersistPlaceEmbedding(
  admin: SupabaseClient,
  place: EmbeddablePlace,
  apiKey: string,
  logPrefix = "place-embeddings",
  via: EmbeddingVia = "update",
  mode: "synth" | "stored" = "synth",
): Promise<PlaceEmbeddingWrite | null> {
  const facts = placeEmbeddingFacts(place);
  const factsHash = await digest(facts);

  const nameText = placeNameEmbedText(place);
  const nameHash = nameText ? await digest(nameText) : "";
  const summaryFresh = !!(
    place.embedding &&
    place.embedding_source_text?.trim() &&
    place.embedding_source_hash === factsHash
  );
  const nameFresh = !!(
    nameText &&
    place.name_embedding &&
    place.name_embedding_hash === nameHash
  );

  if (summaryFresh && (nameFresh || !nameText)) {
    return {
      embedding: [],
      hash: factsHash,
      text: place.embedding_source_text!.trim(),
      skipped: true,
      nameSkipped: true,
    };
  }

  const models = await loadModelsConfig(admin);
  const model = models.embeddingModel || DEFAULT_EMBEDDING_MODEL;
  const patch: PlacePatch = {};
  let vector: number[] = [];
  let text = place.embedding_source_text?.trim() ?? "";
  let wroteSummary = false;
  let wroteName = false;

  if (!summaryFresh) {
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
    // The hash is stamped at EMBED time — it certifies "the stored vector is
    // the embedding of the current facts' text", which is only true now.
    patch.embedding_source_hash = factsHash;
    if (mode !== "stored") patch.embedding_source_text = text;
    wroteSummary = true;
  }

  if (nameText && !nameFresh) {
    let nameVector: number[];
    try {
      nameVector = await embedSingle(nameText, apiKey, model);
    } catch (err) {
      console.error(`[${logPrefix}] name embed failed:`, err);
      return null;
    }
    if (nameVector.length !== EMBEDDING_DIMS) {
      console.error(`[${logPrefix}] name bad dims ${nameVector.length}`);
      return null;
    }
    patch.name_embedding = vectorLiteral(nameVector);
    patch.name_embedding_hash = nameHash;
    wroteName = true;
  }

  if (Object.keys(patch).length === 0) {
    return {
      embedding: vector,
      hash: factsHash,
      text,
      skipped: true,
      nameSkipped: true,
    };
  }

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
  // One function writes both vectors. A hash-match skip does not re-stamp.
  // `via` names the caller so the Monitor attributes the beacon.
  if (wroteSummary || wroteName) {
    const bits = [
      wroteSummary
        ? `Semantic Summary embedded — ${countWords(text)} word(s).`
        : null,
      wroteName
        ? `Mesita Name embedded — ${nameText}.`
        : null,
    ].filter((s): s is string => s != null);
    await reportPulsePieces(admin, place.id, {
      embedding: pieceDone(bits.join(" "), { via }),
    });
  }

  return {
    embedding: vector,
    hash: factsHash,
    text,
    skipped: !wroteSummary,
    nameSkipped: !wroteName,
  };
}

async function loadEmbeddablePlace(
  admin: SupabaseClient,
  placeId: string,
): Promise<EmbeddablePlace | null> {
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, name, category, description, zone, city, address, price_level, embedding, embedding_source_hash, embedding_source_text, name_embedding, name_embedding_hash",
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

export { loadEmbeddablePlace };

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
  const edgeRuntime = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(task);
  else void task;
}
