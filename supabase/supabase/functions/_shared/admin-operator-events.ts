// Operator lifecycle ledger (MESITA-2745): Create · Update · Enrich · Edit.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const ADMIN_OPERATOR_VERBS = [
  "create",
  "update",
  "enrich",
  "edit",
] as const;
export type AdminOperatorVerb = (typeof ADMIN_OPERATOR_VERBS)[number];

export const ADMIN_OPERATOR_OUTCOMES = ["succeeded", "failed"] as const;
export type AdminOperatorOutcome = (typeof ADMIN_OPERATOR_OUTCOMES)[number];

export type AdminOperatorEventInsert = {
  verb: AdminOperatorVerb;
  outcome: AdminOperatorOutcome;
  placeId?: string | null;
  actorUserId: string | null;
  source: string;
  detail?: Record<string, unknown>;
};

/** Best effort: a ledger miss is logged and never fails the admin action. */
export async function recordAdminOperatorEvent(
  admin: SupabaseClient,
  rec: AdminOperatorEventInsert,
): Promise<void> {
  try {
    const { error } = await admin.from("admin_operator_events").insert({
      verb: rec.verb,
      outcome: rec.outcome,
      place_id: rec.placeId ?? null,
      actor_user_id: rec.actorUserId,
      source: rec.source,
      detail: rec.detail ?? {},
    });
    if (error) {
      console.error("[admin-operator-events] insert:", error.message);
    }
  } catch (err) {
    console.error(
      "[admin-operator-events] insert threw:",
      err instanceof Error ? err.message : err,
    );
  }
}

export type AdminOperatorEventRow = {
  id: number;
  verb: string;
  outcome: string;
  place_id: string | null;
  source: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export type OperatorVerbCounts = Record<
  AdminOperatorVerb,
  { succeeded: number; failed: number }
>;

export function summarizeOperatorVerbs(
  rows: readonly AdminOperatorEventRow[],
): OperatorVerbCounts {
  const counts: OperatorVerbCounts = {
    create: { succeeded: 0, failed: 0 },
    update: { succeeded: 0, failed: 0 },
    enrich: { succeeded: 0, failed: 0 },
    edit: { succeeded: 0, failed: 0 },
  };
  for (const row of rows) {
    const verb = (ADMIN_OPERATOR_VERBS as readonly string[]).includes(row.verb)
      ? (row.verb as AdminOperatorVerb)
      : null;
    if (!verb) continue;
    const outcome = row.outcome === "failed" ? "failed" : "succeeded";
    counts[verb][outcome] += 1;
  }
  return counts;
}

export type ActivityFeedItem = {
  id: string;
  at: string;
  line: string;
};

export function operatorFeedLine(row: AdminOperatorEventRow): string {
  const detail = row.detail ?? {};
  const count = typeof detail.count === "number" ? detail.count : null;
  const action = typeof detail.action === "string" ? detail.action : null;
  const bits = [
    row.verb.charAt(0).toUpperCase() + row.verb.slice(1),
    row.outcome,
  ];
  if (count != null && count > 1) bits.push(`${count} places`);
  if (action) bits.push(action);
  if (row.place_id) bits.push(row.place_id.slice(0, 8));
  return bits.join(" · ");
}

export function guestOpenFeedLine(row: {
  outcome: string;
  google_place_id: string;
  place_id: string | null;
}): string {
  const place = row.place_id ? row.place_id.slice(0, 8) : "—";
  return `Guest open · ${row.outcome} · ${row.google_place_id.slice(0, 12)}… · place ${place}`;
}

export function mergeActivityFeed(
  guestOpens: Array<{
    id: number;
    created_at: string;
    outcome: string;
    google_place_id: string;
    place_id: string | null;
  }>,
  operatorEvents: AdminOperatorEventRow[],
  limit = 50,
): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = [
    ...guestOpens.map((row) => ({
      id: `open-${row.id}`,
      at: row.created_at,
      line: guestOpenFeedLine(row),
    })),
    ...operatorEvents.map((row) => ({
      id: `op-${row.id}`,
      at: row.created_at,
      line: operatorFeedLine(row),
    })),
  ];
  items.sort((a, b) => b.at.localeCompare(a.at));
  return items.slice(0, limit);
}
