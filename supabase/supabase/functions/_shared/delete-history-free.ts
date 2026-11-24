// MESITA-1250 — the deletion law, encoded above the DB.
//
// Atlas §C: a place or consumer with transaction history is NEVER
// hard-deleted. Deletion is a state; references stay valid forever (that is
// what ON DELETE RESTRICT on reservation tickets means). Hard-delete
// exists only here, for history-free aggregates, and in admin_reset_database
// which wipes history WITH the aggregates.
//
// This module is THE blessed delete door. consumer-web-delete-account is the
// HTTP caller; it does not delete tickets itself.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { writeConsumer } from "./consumer-doc.ts";
import { json } from "./http.ts";
import { TOMBSTONE_EMAIL_DOMAIN } from "./tombstone-email.ts";

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

export type DeleteConsumerResult =
  | { ok: true; mode: "soft" | "hard" }
  | { ok: false; error: string };

/**
 * What counts as history (MESITA-4921): bookings, and every money row. A hard
 * delete would cascade bills and loyalty cards away, cut credit and payments
 * from their owner, or be refused by guest_pay_attempts. A new money table
 * that points at consumers belongs here.
 */
export const HISTORY = [
  ["reservation_tickets", "consumer_id"],
  ["guest_pay_attempts", "consumer_id"],
  ["pay_bills", "consumer_id"],
  ["pay_tabs", "consumer_id"],
  ["place_backings", "consumer_id"],
  ["place_charges", "consumer_id"],
  ["premier_refill_purchases", "consumer_id"],
  ["wallet_entries", "consumer_id"],
  ["wallet_gifts", "sender_id"],
  ["wallet_gifts", "recipient_id"],
  ["wallet_loyalty_cards", "consumer_id"],
  ["wallet_payments", "consumer_id"],
  ["wallet_purchases", "consumer_id"],
] as const;

/** Personal rows a closed account has no use for; a hard delete cascades them. */
const PERSONAL = ["saved_locations", "consumer_calendar_feeds", "consumer_notifications"] as const;

export const AVATAR_BUCKET = "consumer-avatars";

/** Every stored photo of theirs. Best effort: the account is closed either way. */
async function removeAvatars(admin: SupabaseClient, userId: string): Promise<void> {
  const bucket = admin.storage.from(AVATAR_BUCKET);
  const { data, error } = await bucket.list(userId, { limit: 1000 });
  const removed = error || !data?.length
    ? { error }
    : await bucket.remove(data.map((o) => `${userId}/${o.name}`));
  if (removed.error) console.error(`[delete-account] avatars of ${userId} stay: ${removed.error.message}`);
}

export async function consumerHasTransactionHistory(
  admin: SupabaseClient,
  consumerId: string,
): Promise<{ ok: true; hasHistory: boolean } | { ok: false; error: string }> {
  // One failed read refuses the whole delete: an unread table is not an empty one.
  const reads = await Promise.all(HISTORY.map(async ([table, column]) => {
    const { error, count } = await admin
      .from(table)
      .select(column, { count: "exact", head: true })
      .eq(column, consumerId);
    return { table, error, count };
  }));
  const failed = reads.find((r) => r.error || r.count === null);
  if (failed) {
    return { ok: false, error: `${failed.table}_count: ${failed.error?.message ?? "no count"}` };
  }
  return { ok: true, hasHistory: reads.some((r) => (r.count ?? 0) > 0) };
}

/** Hide the row, clear the person off it and free phone/email so the same person can sign up again. */
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
      // MESITA-4921: nothing about the person stays on the row.
      full_name: null,
      first_name: null,
      last_name: null,
      sex: null,
      birthday: null,
      birth_year: null,
      avatar_url: null,
      social_private: true,
      phone: null,
      instagram_handle: null,
      instagram_followers_count: null,
      instagram_verified_at: null,
      // MESITA-4659: the sharing choice goes with the handle.
      instagram_handle_shown: null,
    },
  });
  if (!row.ok) return { ok: false, error: `consumer_tombstone: ${row.error}` };

  // The name each bill copied (guest_pay_attempts.guest_label).
  const labels = await admin.from("guest_pay_attempts").update({ guest_label: "Guest" }).eq("consumer_id", userId);
  if (labels.error) return { ok: false, error: `guest_label_clear: ${labels.error.message}` };
  for (const table of PERSONAL) {
    const { error } = await admin.from(table).delete().eq("consumer_id", userId);
    if (error) return { ok: false, error: `${table}_clear: ${error.message}` };
  }

  const tombstoneEmail = `deleted-${userId}${TOMBSTONE_EMAIL_DOMAIN}`;
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
 * reservation_tickets.
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
    await removeAvatars(admin, userId);
    return { ok: true, mode: "soft" };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: `auth_delete: ${error.message}` };
  await removeAvatars(admin, userId);
  return { ok: true, mode: "hard" };
}
