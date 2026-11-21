// The Story bonus's re-check (MESITA-4264; on the Story record since
// MESITA-4405), shared by supabase-cron-recheck-stories and the operator's
// recheck_now: read the approved Stories whose recheck_at has come, with the
// mention each holds, fetch each story again (storyStillUp), and hand the
// answer to story_settle (released | retry | void deleted | void unreachable).
// Each decision writes its Story log line.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type RecheckRow,
  recheckReachable,
  runRecheckTick,
  type SettleAnswer,
  storyStillUp,
  type TickReport,
} from "./story-mention.ts";
import { storyLog } from "./story-log.ts";

type Due = { id: string; purchase_id: string; mention_id: string | null };
type Held = {
  id: string;
  source: "meta" | "emulator";
  media_url: string | null;
  deleted_at: string | null;
  mentioned_at: string | null;
  reachable_at_bonus: boolean | null;
};

async function withMentions(admin: SupabaseClient, due: Due[]): Promise<RecheckRow[]> {
  if (due.length === 0) return [];
  const ids = due.map((d) => d.mention_id).filter((x): x is string => !!x);
  const byId = new Map<string, Held>();
  if (ids.length > 0) {
    const { data, error } = await admin.from("story_mentions").select("id, source, media_url, deleted_at, mentioned_at, reachable_at_bonus").in("id", ids);
    if (error) throw new Error(`story_mentions: ${error.message}`);
    for (const m of (data ?? []) as Held[]) byId.set(m.id, m);
  }
  return due.map((d) => {
    const m = d.mention_id ? byId.get(d.mention_id) : undefined;
    return {
      story_id: d.id,
      purchase_id: d.purchase_id,
      mention: m
        ? { source: m.source, media_url: m.media_url, deleted_at: m.deleted_at, mentioned_at: m.mentioned_at, reachable_at_bonus: m.reachable_at_bonus }
        : null,
    };
  });
}

/** Approved Stories whose re-check time has come, oldest first. */
export async function recheckRows(admin: SupabaseClient, nowIso: string, limit: number): Promise<RecheckRow[]> {
  const { data, error } = await admin.from("stories")
    .select("id, purchase_id, mention_id")
    .eq("state", "approved")
    .lte("recheck_at", nowIso)
    .order("recheck_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`stories: ${error.message}`);
  return withMentions(admin, (data ?? []) as Due[]);
}

type SettleRpc = SettleAnswer & { reason?: string; story_id?: string; purchase_id?: string; place_id?: string; livemode?: boolean };

export function runStoryRecheck(admin: SupabaseClient, rows: RecheckRow[], recheckMeta: boolean, via = "cron"): Promise<TickReport> {
  return runRecheckTick({
    rows,
    check: (row) => recheckReachable(row, recheckMeta, (url) => storyStillUp(url)),
    settle: async (storyId, reachable, deleted) => {
      const { data, error } = await admin.rpc("story_settle", { p_story: storyId, p_reachable: reachable, p_deleted: deleted });
      if (error) throw new Error(`story_settle: ${error.message}`);
      const r = (data ?? {}) as SettleRpc;
      const fields = { story_id: storyId, purchase_id: r.purchase_id, place_id: r.place_id, livemode: r.livemode, via };
      if (r.outcome === "released") storyLog("released", fields);
      if (r.outcome === "voided") storyLog("void", { ...fields, reason: r.reason });
      return r;
    },
  });
}

/** One Story re-checked now (by its purchase id), whatever its recheck_at. */
export async function recheckOne(admin: SupabaseClient, purchaseId: string, recheckMeta: boolean, via = "operator"): Promise<TickReport> {
  const { data, error } = await admin.from("stories").select("id, purchase_id, mention_id").eq("purchase_id", purchaseId);
  if (error) throw new Error(`stories: ${error.message}`);
  return runStoryRecheck(admin, await withMentions(admin, (data ?? []) as Due[]), recheckMeta, via);
}
