// The door every Edge Function opens through: one per caller, all in this
// file, all the same shape (MESITA-3612). The EF name's prefix says which
// door it uses:
//
//   door                        callers                     who gets in
//   openRequest                 visit-web-*, public reads   anyone (POST)
//   requireConsumerRequest      consumer-web-*              a signed-in guest
//   requireBusinessRequest      business-web-*              a Google sign-in
//   requireBusinessSuperAdmin   business-web-* (ops only)   ...who is a super-admin
//   requireAdminRequest         admin-web-*                 a super-admin
//   requireAgentRequest         eleven-*                    x-agent-secret
//   requireInternalRequest      supabase-cron-*, -edgefunc  a service-role bearer
//   requireEnrichWriteRequest   enricher-edgefunc-*         ENRICH_WRITE_KEY
//
// Webhooks (meta-*, stripe-*, supabase-auth-*) answer their vendor's own
// protocol (signatures, plain text, hook envelopes) and open by hand.
//
// Every door runs openRequest first, in this order: CORS preflight, method
// (405), env (500), service-role client. Then its own check. A door returns
// its context, or the exact Response to send:
//
//   const ctx = await requireConsumerRequest(req);
//   if (ctx instanceof Response) return ctx;
//   const { env, admin, user } = ctx;
//
// The body is read after the door, in the handler: every caller's 401/403
// comes before its 400.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsPreflight, json, rejectUnlessMethods } from "./http.ts";
import { adminClient, type AuthedUser, bearerToken, type EFEnv, getAuthedUser, readEFEnv } from "./auth.ts";
import { checkSuperAdmin, requireSuperAdmin } from "./auth-super-admin.ts";
import { requireInternalCaller } from "./internal.ts";
import { timingSafeEqual } from "./timing-safe-equal.ts";

export type OpenRequest = { env: EFEnv; admin: SupabaseClient };
export type UserRequest = OpenRequest & { user: AuthedUser };
export type InternalRequest = OpenRequest & { callerName: string };

/** The four steps every door shares. `methods` defaults to POST. */
export function openRequest(req: Request, methods: readonly string[] = ["POST"]): OpenRequest | Response {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, ...methods);
  if (methodReject) return methodReject;
  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  return { env: envRes.env, admin: adminClient(envRes.env) };
}

/** The signed-in caller, or the 401 to send. */
async function withUser(req: Request, ctx: OpenRequest, unauthorized?: Response): Promise<UserRequest | Response> {
  const authRes = await getAuthedUser(req, ctx.env);
  if (!authRes.ok) return unauthorized ?? authRes.response;
  return { ...ctx, user: authRes.user };
}

// ─── consumer-web-* ─────────────────────────────────────────────────

export type ConsumerDoor = {
  /** The 401's words for a guest who isn't signed in: the reply becomes
   *  `{ ok:false, code:"sign_in", error: signIn }`, which the app turns into
   *  its sign-in sheet. Without it the 401 is auth's own. */
  signIn?: string;
  methods?: readonly string[];
};

export async function requireConsumerRequest(req: Request, door: ConsumerDoor = {}): Promise<UserRequest | Response> {
  const ctx = openRequest(req, door.methods);
  if (ctx instanceof Response) return ctx;
  const unauthorized = door.signIn === undefined
    ? undefined
    : json({ ok: false, code: "sign_in", error: door.signIn }, 401);
  return await withUser(req, ctx, unauthorized);
}

// ─── business-web-* ─────────────────────────────────────────────────
//
// GOOGLE ACCOUNTS ONLY (Pato, 2026-11-02, MESITA-3105): the Business app
// signs in with Google; a phone session gets 403 `google_only`, so a guest's
// consumer-app cookie can never open the Business app. Who may touch which
// place is `place-access.ts`, asked per place after this.

/** A Google sign-in with an email: the only identity the Business app takes. Pure. */
export function isGoogleAccount(user: Pick<AuthedUser, "emailLower" | "raw">): boolean {
  if (!user.emailLower) return false;
  const meta = (user.raw?.app_metadata ?? {}) as { provider?: unknown; providers?: unknown };
  const providers = Array.isArray(meta.providers) ? meta.providers : [];
  return meta.provider === "google" || providers.includes("google");
}

export async function requireBusinessRequest(req: Request): Promise<UserRequest | Response> {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const userCtx = await withUser(req, ctx);
  if (userCtx instanceof Response) return userCtx;
  if (!isGoogleAccount(userCtx.user)) {
    return json({ ok: false, code: "google_only", error: "Mesita Business signs in with a Google account" }, 403);
  }
  return userCtx;
}

/** A super-admin-only business door: the context, or 403. */
export async function requireBusinessSuperAdmin(req: Request): Promise<UserRequest | Response> {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  if (!(await checkSuperAdmin(ctx.admin, ctx.user))) {
    return json({ ok: false, error: "Not a super-admin" }, 403);
  }
  return ctx;
}

// ─── admin-web-* ────────────────────────────────────────────────────

/** A super-admin: 401 with no identity on the session, 403 with
 *  `forbiddenMessage` (default "Not a super-admin") otherwise. */
export async function requireAdminRequest(req: Request, forbiddenMessage?: string): Promise<UserRequest | Response> {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const userCtx = await withUser(req, ctx);
  if (userCtx instanceof Response) return userCtx;
  const saRes = await requireSuperAdmin(userCtx.admin, userCtx.user, forbiddenMessage);
  if (!saRes.ok) return saRes.response;
  return userCtx;
}

// ─── eleven-* ───────────────────────────────────────────────────────

/** An ElevenLabs agent tool: `x-agent-secret` matches the rotatable
 *  app_config.agents_config.toolSecret, else 401. */
export async function requireAgentRequest(req: Request): Promise<OpenRequest | Response> {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const sent = (req.headers.get("x-agent-secret") ?? "").trim();
  const { data: settings } = await ctx.admin
    .from("app_config")
    .select("agents_config")
    .eq("id", 1)
    .maybeSingle();
  const toolSecret = (settings?.agents_config as Record<string, unknown> | null)?.toolSecret;
  const expected = typeof toolSecret === "string" ? toolSecret.trim() : "";
  if (!expected || !sent || !timingSafeEqual(sent, expected)) {
    return json({ ok: false, error: "agent tool secret rejected" }, 401);
  }
  return ctx;
}

// ─── supabase-cron-* · supabase-edgefunc-* ──────────────────────────

/** Another EF or pg_cron with a service-role bearer. Only on a
 *  verify_jwt = true function: read the invariant in internal.ts. */
export function requireInternalRequest(req: Request): InternalRequest | Response {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const gate = requireInternalCaller(req, ctx.env);
  if (!gate.ok) return gate.response;
  return { ...ctx, callerName: gate.callerName };
}

// ─── enricher-edgefunc-* ────────────────────────────────────────────

/** Render's Enricher: `Authorization: Bearer <ENRICH_WRITE_KEY>`. These run
 *  verify_jwt = false, so this key — never the internal role check — is
 *  their lock. 500 when the key is unset, 401 on a mismatch. */
export function requireEnrichWriteRequest(req: Request): OpenRequest | Response {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const expected = (Deno.env.get("ENRICH_WRITE_KEY") ?? "").trim();
  if (!expected) return json({ ok: false, error: "Server misconfigured" }, 500);
  const sent = bearerToken(req);
  if (!sent || !timingSafeEqual(sent, expected)) return json({ ok: false, error: "Unauthorized" }, 401);
  return ctx;
}
