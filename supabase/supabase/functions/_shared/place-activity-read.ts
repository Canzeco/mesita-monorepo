// The two reads every Social Edge Function shares (MESITA-3042 split them out
// of consumer-web-list-activity): the place cards behind a list of activity
// rows, and whether the viewer sees other members' full handles.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { PLACE_CARD_COLUMNS } from "./place-columns.ts";
import { type PlaceCategoryRow, withFamilyKeysList } from "./place-family-keys.ts";
import { seesHandles } from "./place-activity.ts";
import { readSocialStanding } from "./consumer-doc.ts";

export type Card = Record<string, unknown> & { id: string; lat?: number | null; lng?: number | null };

/** Place cards for ids, through the browse view (RLS keeps unlisted places
 *  out), keyed by id. */
export async function readCards(
  anon: SupabaseClient,
  ids: string[],
): Promise<{ ok: true; cards: Map<string, Card> } | { ok: false; error: string }> {
  if (ids.length === 0) return { ok: true, cards: new Map() };
  const { data, error } = await anon.from("profiles").select(PLACE_CARD_COLUMNS).in("id", ids);
  if (error) return { ok: false, error: `cards: ${error.message}` };
  const rows = withFamilyKeysList(
    (data ?? []) as unknown as Array<Card & PlaceCategoryRow>,
  ) as unknown as Card[];
  return { ok: true, cards: new Map(rows.map((r) => [r.id, r])) };
}

/** Whether this viewer sees other members' full handles (MESITA-2594). An
 *  unreadable row masks: the safe side is showing less. */
export async function viewerSeesHandles(
  admin: SupabaseClient,
  viewerId: string,
): Promise<boolean> {
  const res = await readSocialStanding(admin, viewerId);
  if (!res.ok) {
    console.error("viewer_standing_failed", res.error);
    return false;
  }
  return seesHandles(res.row);
}
