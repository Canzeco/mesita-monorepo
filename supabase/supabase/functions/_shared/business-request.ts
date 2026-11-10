// The Business app's account step (MESITA-3103): the caller's consumers row,
// made on first sign-in. The door itself is requireBusinessRequest in
// request.ts.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { AuthedUser } from "./auth.ts";
import { writeConsumer } from "./consumer-doc.ts";
import { isDeletedConsumer } from "./delete-history-free.ts";

/** The caller's consumers row, created on first sign-in (an owner is a guest
 *  account: Premier's payer FK and place_managers point at consumers). A
 *  Google sign-in has no phone, so the row is created without one. */
export async function ensureConsumer(
  admin: SupabaseClient,
  user: AuthedUser,
): Promise<{ ok: true; consumerId: string | null } | { ok: false; status: number; error: string; code?: string }> {
  const existing = await admin.from("consumers").select("id, phone, deleted_at").eq("id", user.id).maybeSingle();
  if (existing.error) return { ok: false, status: 500, error: `consumer_read: ${existing.error.message}` };
  if (existing.data) {
    if (isDeletedConsumer(existing.data)) {
      return { ok: false, status: 410, code: "account_deleted", error: "This account was deleted" };
    }
    return { ok: true, consumerId: existing.data.id as string };
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const codeResult = await admin.rpc("generate_consumer_code");
    if (codeResult.error) return { ok: false, status: 500, error: `code_gen: ${codeResult.error.message}` };
    const inserted = await writeConsumer(admin, {
      mode: "insert",
      id: user.id,
      patch: { code: codeResult.data as string, phone: user.phone ?? null },
      select: "id",
    });
    if (inserted.ok) return { ok: true, consumerId: user.id };
    if (inserted.code !== "23505") return { ok: false, status: 500, error: `consumer_create: ${inserted.error}` };
    const refetch = await admin.from("consumers").select("id").eq("id", user.id).maybeSingle();
    if (refetch.data) return { ok: true, consumerId: user.id };
  }
  return { ok: false, status: 500, error: "consumer_create: conflict" };
}
