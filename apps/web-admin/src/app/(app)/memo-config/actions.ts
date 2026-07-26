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
import type { AskMemoResult, MemoConfig, MemoPrediction } from "./types";

export type { AskMemoResult, MemoConfig, MemoPrediction } from "./types";

export type GetMemoConfigResult =
  | { ok: true; data: MemoConfig }
  | { ok: false; error: string };

export async function getMemoConfig(): Promise<GetMemoConfigResult> {
  const r = await efInvoke<MemoConfig>("admin-web-get-memo-config", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

export type UpdateMemoConfigResult =
  | { ok: true; data: MemoConfig }
  | { ok: false; error: string };

export async function updateMemoConfig(
  patch: Partial<MemoConfig>,
): Promise<UpdateMemoConfigResult> {
  const r = await efInvoke<MemoConfig>("admin-web-update-memo-config", patch);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}

// Playground — run one live Memo query at the current SAVED persona so an
// operator can dogfood the concierge from the admin console.
//
// It calls the consumer concierge EF directly. Two honest caveats, both tracked
// for a dedicated super-admin `admin-web-ask-memo` EF follow-up:
//   • ACL: the admin origin calling a `consumer-*` endpoint bends the
//     one-caller-per-endpoint rule.
//   • It can only exercise the SAVED persona — there is no draft override, so
//     save Config edits before testing them here.
// `consumer-web-ask-memo` is verify_jwt=false + optional-auth, so this works
// today with no deploy.
export async function askMemo(input: {
  query: string;
  latitude?: number;
  longitude?: number;
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
  }>("consumer-web-ask-memo", {
    query,
    latitude: input.latitude,
    longitude: input.longitude,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    answer: r.data.answer ?? "",
    predictions: r.data.predictions ?? [],
    related: r.data.related ?? [],
    citations: r.data.citations ?? [],
  };
}
