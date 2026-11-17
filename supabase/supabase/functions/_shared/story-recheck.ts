// The Story bonus's re-check (MESITA-4264), shared by
// supabase-cron-recheck-stories and the operator's recheck_now: read the
// due purchases with the mention each claimed, fetch each story again
// (storyStillUp), and hand the answer to wallet_settle_story_recheck.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type RecheckRow,
  recheckReachable,
  runRecheckTick,
  type SettleAnswer,
  storyStillUp,
  type TickReport,
} from "./story-mention.ts";

type Claimed = { purchase_id: string; source: "meta" | "emulator"; media_url: string | null };

async function withMentions(admin: SupabaseClient, ids: string[]): Promise<RecheckRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await admin.from("story_mentions").select("purchase_id, source, media_url").in("purchase_id", ids);
  if (error) throw new Error(`story_mentions: ${error.message}`);
  const byId = new Map(((data ?? []) as Claimed[]).map((m) => [m.purchase_id, m]));
  return ids.map((id) => {
    const m = byId.get(id);
    return { purchase_id: id, mention: m ? { source: m.source, media_url: m.media_url } : null };
  });
}

/** Approved Stories with no bonus decision whose re-check time has come. */
export async function recheckRows(admin: SupabaseClient, nowIso: string, limit: number): Promise<RecheckRow[]> {
  const { data, error } = await admin.from("wallet_purchases")
    .select("id")
    .eq("voucher", "voucher_story").eq("story_review", "approved").is("story_bonus", null)
    .lte("story_recheck_at", nowIso)
    .order("story_recheck_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`wallet_purchases: ${error.message}`);
  return withMentions(admin, ((data ?? []) as Array<{ id: string }>).map((r) => r.id));
}

export function runStoryRecheck(admin: SupabaseClient, rows: RecheckRow[], recheckMeta: boolean): Promise<TickReport> {
  return runRecheckTick({
    rows,
    check: (row) => recheckReachable(row, recheckMeta, (url) => storyStillUp(url)),
    settle: async (purchaseId, reachable) => {
      const { data, error } = await admin.rpc("wallet_settle_story_recheck", { p_purchase: purchaseId, p_reachable: reachable });
      if (error) throw new Error(`wallet_settle_story_recheck: ${error.message}`);
      return (data ?? {}) as SettleAnswer;
    },
  });
}

/** One purchase re-checked now, whatever its story_recheck_at. */
export async function recheckOne(admin: SupabaseClient, purchaseId: string, recheckMeta: boolean): Promise<TickReport> {
  return runStoryRecheck(admin, await withMentions(admin, [purchaseId]), recheckMeta);
}
