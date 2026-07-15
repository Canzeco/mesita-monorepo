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

import { efResult, type EfResult } from "@/lib/supabase-ef";
import type { MemoConfig } from "./types";

export type { MemoConfig } from "./types";

export async function getMemoConfig(): Promise<EfResult<MemoConfig>> {
  return efResult<MemoConfig>("admin-web-get-memo-config", {});
}

export async function updateMemoConfig(
  patch: Partial<MemoConfig>,
): Promise<EfResult<MemoConfig>> {
  return efResult<MemoConfig>("admin-web-update-memo-config", patch);
}
