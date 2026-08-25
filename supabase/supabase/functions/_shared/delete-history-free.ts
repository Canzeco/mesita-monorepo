// MESITA-1250 — the deletion law, encoded above the DB.
//
// Atlas §C: a place or consumer with transaction history is NEVER
// hard-deleted. Deletion is a status; references stay valid forever (that is
// what ON DELETE RESTRICT on visit/reservation tickets means). Hard-delete
// exists only here, for history-free aggregates, and in admin_reset_database
// which wipes history WITH the aggregates.
//
// This module is THE blessed delete door. consumer-web-delete-account is the
// HTTP caller; it does not delete tickets itself.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { writeConsumer } from "./consumer-doc.ts";
import { json } from "./http.ts";

export function isDeletedConsumer(
  row: { deleted_at?: string | null } | null | undefined,
): boolean {
  return typeof row?.deleted_at === "string" && row.deleted_at.length > 0;
}

/** 410 for a closed consumer account. Same body on every guest surface. */
export function accountDeletedResponse(): Response {
  return json({
    ok: false,
    error: "This account is closed.",
    code: "account_deleted",
  }, 410);
}

export async function rejectDeletedConsumer(
  admin: SupabaseClient,
  userId: string,
): Promise<Response | null> {
  const { data, error } = await admin
    .from("consumers")
    .select("deleted_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) return json({ ok: false, error: `consumer_read: ${error.message}` }, 500);
  if (isDeletedConsumer(data)) return accountDeletedResponse();
  return null;
}

export type DeleteConsumerResult =
  | { ok: true; mode: "soft" | "hard" }
  | { ok: false; error: string };

async function countBy(
  admin: SupabaseClient,
  table: "visit_tickets" | "reservation_tickets",
  consumerId: string,
): Promise<{ ok: true; n: number } | { ok: false; error: string }> {
  const { error, count } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("consumer_id", consumerId);
  if (error) return { ok: false, error: `${table}_count: ${error.message}` };
  return { ok: true, n: count ?? 0 };
}

export async function consumerHasTransactionHistory(
  admin: SupabaseClient,
  consumerId: string,
): Promise<{ ok: true; hasHistory: boolean } | { ok: false; error: string }> {
  const visits = await countBy(admin, "visit_tickets", consumerId);
  if (!visits.ok) return visits;
  if (visits.n > 0) return { ok: true, hasHistory: true };
  const reservations = await countBy(admin, "reservation_tickets", consumerId);
  if (!reservations.ok) return reservations;
  return { ok: true, hasHistory: reservations.n > 0 };
}

/** Hide the row and free phone/email so the same person can sign up again. */
export async function tombstoneDeletedConsumer(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const row = await writeConsumer(admin, {
    mode: "update",
    id: userId,
    patch: {
      deleted_at: now,
      phone: null,
      instagram_handle: null,
    },
  });
  if (!row.ok) return { ok: false, error: `consumer_tombstone: ${row.error}` };

  const tombstoneEmail = `deleted-${userId}@tombstone.mesita.invalid`;
  const attempts: Record<string, string>[] = [
    { email: tombstoneEmail, phone: "", ban_duration: "876000h" },
    { email: tombstoneEmail, ban_duration: "876000h" },
  ];
  let lastError = "auth tombstone failed";
  for (const attrs of attempts) {
    const auth = await admin.auth.admin.updateUserById(userId, attrs);
    if (!auth.error) return { ok: true };
    lastError = auth.error.message;
  }
  return { ok: false, error: `auth_tombstone: ${lastError}` };
}

/**
 * THE blessed consumer delete. History → soft (deleted_at + auth tombstone).
 * History-free → hard-delete auth.users (consumers cascades). Never deletes
 * visit_tickets or reservation_tickets.
 */
export async function deleteConsumerAccount(
  admin: SupabaseClient,
  userId: string,
): Promise<DeleteConsumerResult> {
  const history = await consumerHasTransactionHistory(admin, userId);
  if (!history.ok) return history;

  if (history.hasHistory) {
    const tomb = await tombstoneDeletedConsumer(admin, userId);
    if (!tomb.ok) return tomb;
    return { ok: true, mode: "soft" };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: `auth_delete: ${error.message}` };
  return { ok: true, mode: "hard" };
}
