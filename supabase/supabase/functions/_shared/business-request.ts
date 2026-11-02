// The opening every business-web-* EF shares (MESITA-3103), in this order:
// CORS preflight, POST, env (500), bearer session (401), service-role client.
// Who may touch which place is `place-access.ts`, asked per place after this.
//
// GOOGLE ACCOUNTS ONLY (Pato, 2026-11-02, MESITA-3105): the Business app
// signs in with Google; a phone session gets 403 `google_only` here, so a
// guest's consumer-app cookie can never open the Business app.
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

/** A Google sign-in with an email: the only identity the Business app takes. Pure. */
export function isGoogleAccount(user: Pick<AuthedUser, "emailLower" | "raw">): boolean {
  if (!user.emailLower) return false;
  const meta = (user.raw?.app_metadata ?? {}) as { provider?: unknown; providers?: unknown };
  const providers = Array.isArray(meta.providers) ? meta.providers : [];
  return meta.provider === "google" || providers.includes("google");
}

export async function requireBusinessRequest(req: Request): Promise<BusinessRequest | Response> {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;
  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  if (!isGoogleAccount(authRes.user)) {
    return json({ ok: false, code: "google_only", error: "Mesita Business signs in with a Google account" }, 403);
  }
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
