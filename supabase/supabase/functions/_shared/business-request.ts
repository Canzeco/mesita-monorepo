// The opening every business-web-* EF shares (MESITA-3103), in this order:
// CORS preflight, POST, env (500), bearer session (401), service-role client.
// Who may touch which place is `place-access.ts`, asked per place after this.
//
//   const ctx = await requireBusinessRequest(req);
//   if (ctx instanceof Response) return ctx;
//   const { env, admin, user } = ctx;

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsPreflight, json, rejectUnlessMethods } from "./http.ts";
import { adminClient, type AuthedUser, type EFEnv, getAuthedUser, readEFEnv } from "./auth.ts";
import { checkSuperAdmin } from "./auth-super-admin.ts";
import { writeConsumer } from "./consumer-doc.ts";
import { isDeletedConsumer } from "./delete-history-free.ts";

export type BusinessRequest = { env: EFEnv; admin: SupabaseClient; user: AuthedUser };

export async function requireBusinessRequest(req: Request): Promise<BusinessRequest | Response> {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;
  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  return { env: envRes.env, admin: adminClient(envRes.env), user: authRes.user };
}

/** A super-admin-only business door: the context, or 403. */
export async function requireBusinessSuperAdmin(req: Request): Promise<BusinessRequest | Response> {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  if (!(await checkSuperAdmin(ctx.admin, ctx.user))) {
    return json({ ok: false, error: "Not a super-admin" }, 403);
  }
  return ctx;
}

/** The caller's consumers row, created on first sign-in the way
 *  consumer-web-signin-phone does (an owner is a guest with a phone). Null
 *  when the session has no phone (a Google sign-in). */
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
  if (!user.phone) return { ok: true, consumerId: null };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const codeResult = await admin.rpc("generate_consumer_code");
    if (codeResult.error) return { ok: false, status: 500, error: `code_gen: ${codeResult.error.message}` };
    const inserted = await writeConsumer(admin, {
      mode: "insert",
      id: user.id,
      patch: { code: codeResult.data as string, phone: user.phone },
      select: "id",
    });
    if (inserted.ok) return { ok: true, consumerId: user.id };
    if (inserted.code !== "23505") return { ok: false, status: 500, error: `consumer_create: ${inserted.error}` };
    const refetch = await admin.from("consumers").select("id").eq("id", user.id).maybeSingle();
    if (refetch.data) return { ok: true, consumerId: user.id };
  }
  return { ok: false, status: 500, error: "consumer_create: conflict" };
}
