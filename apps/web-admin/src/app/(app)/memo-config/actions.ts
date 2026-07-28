"use server";

// Server actions for Memo Config. Thin wrappers over the admin-web-* Edge
// Functions via the Result-style efInvoke (never throws) — same contract as the
// Atlas config actions.
//
// Backed by admin-web-get-memo-config / admin-web-update-memo-config, which read
// and write the memo_* columns on the public.app_settings singleton. Memo's
// system prompt (instructions) is consumed live by consumer-web-ask-memo; the
// model knobs are persisted for the forthcoming Memo model rebuild. No client
// ever touches the DB.
//
// Types + model catalogs live in ./types (not here) — "use server" modules may
// only export async functions to the client.

import { efInvoke } from "@/lib/supabase-ef";
import type {
  AskMemoMeta,
  AskMemoResult,
  MemoConfig,
  MemoPrediction,
  SampleConsumer,
  SampleConsumersResult,
  TraceStep,
} from "./types";

export type { AskMemoResult, MemoConfig, MemoPrediction } from "./types";

type GetMemoConfigResult =
  | { ok: true; data: MemoConfig }
  | { ok: false; error: string };

export async function getMemoConfig(): Promise<GetMemoConfigResult> {
  const r = await efInvoke<MemoConfig>("admin-web-get-memo-config", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

type UpdateMemoConfigResult =
  | { ok: true; data: MemoConfig }
  | { ok: false; error: string };

export async function updateMemoConfig(
  patch: Partial<MemoConfig>,
): Promise<UpdateMemoConfigResult> {
  const r = await efInvoke<MemoConfig>("admin-web-update-memo-config", patch);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

// ── Playground ──────────────────────────────────────────────────────────
// The Playground drives Memo's v-next REASONING AGENT via the dedicated
// super-admin `admin-web-ask-memo` EF — a full multi-turn chat AS any persona
// (a real consumer, a mock one, or a signed-out guest), returning Memo's
// internal reasoning trace (the RAG recall + each OpenAI round + every tool
// call). This replaces the old one-shot call to `consumer-web-ask-memo`, which
// bent the ACL (admin origin → consumer endpoint) and could only exercise the
// saved persona.

export async function askMemoAdmin(input: {
  query: string;
  history?: { role: "user" | "assistant"; content: string }[];
  consumerId?: string | null;
  mockProfile?: { name?: string; age?: number; sex?: string } | null;
  latitude?: number | null;
  longitude?: number | null;
  instructions?: string | null;
  model?: string | null;
}): Promise<AskMemoResult> {
  const query = input.query.trim();
  if (query.length < 2) {
    return { ok: false, error: "Enter a query of at least 2 characters." };
  }
  const r = await efInvoke<{
    answer?: string;
    predictions?: MemoPrediction[];
    related?: string[];
    citations?: string[];
    trace?: TraceStep[];
    meta?: AskMemoMeta;
  }>("admin-web-ask-memo", {
    query,
    history: input.history ?? [],
    consumerId: input.consumerId ?? undefined,
    mockProfile: input.mockProfile ?? undefined,
    latitude: input.latitude ?? undefined,
    longitude: input.longitude ?? undefined,
    instructions: input.instructions ?? undefined,
    model: input.model ?? undefined,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    answer: r.data.answer ?? "",
    predictions: r.data.predictions ?? [],
    related: r.data.related ?? [],
    citations: r.data.citations ?? [],
    trace: r.data.trace ?? [],
    meta: r.data.meta,
  };
}

// Sample real consumers for the "talk as a real user" picker. Reuses the
// scoring-sample EF (super-admin gated) which already returns a random sample
// of real consumers with first name + coarse demographics — the same signals
// Memo reasons over. `places: 1` is the EF's minimum; we only read consumers.
export async function sampleConsumers(): Promise<SampleConsumersResult> {
  const r = await efInvoke<{ consumers?: SampleConsumer[] }>(
    "admin-web-get-scoring-sample",
    { consumers: 10, places: 1 },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, consumers: r.data.consumers ?? [] };
}
