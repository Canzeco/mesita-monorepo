// Auth helpers shared by product Edge Functions (admin/consumer/staff) —
// env, JWT user, and service-role client setup.
//
// The three EF entry-points always look the same:
//
//   1. Read SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY → 500 if missing
//   2. Verify Bearer JWT → resolve auth.user → 401 if missing/invalid
//   3. (Admin EFs) confirm the user is in super_admins — 403 otherwise
//
// The super-admin guard (step 3) lives in auth-super-admin.ts and is
// re-exported below so callers keep importing from this module.

import {
  createClient,
  type SupabaseClient,
  type User,
} from "jsr:@supabase/supabase-js@2";
import { corsPreflight, json, rejectUnlessMethods } from "./http.ts";
import { requireSuperAdmin } from "./auth-super-admin.ts";

// ─── Env ────────────────────────────────────────────────────────────

export type EFEnv = {
  url: string;
  anonKey: string;
  serviceKey: string;
};

export function readEFEnv():
  | { ok: true; env: EFEnv }
  | { ok: false; response: Response } {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    return {
      ok: false,
      response: json({ ok: false, error: "Server misconfigured" }, 500),
    };
  }
  return { ok: true, env: { url, anonKey, serviceKey } };
}

// Lighter variant for PUBLIC read endpoints that only need the anon key
// (RLS-restricted reads, no service-role writes, no internal invokes).
// Avoids 500ing on a missing SERVICE_ROLE_KEY that the handler never uses.
export type AnonEnv = { url: string; anonKey: string };

export function readAnonEnv():
  | { ok: true; env: AnonEnv }
  | { ok: false; response: Response } {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    return {
      ok: false,
      response: json({ ok: false, error: "Server misconfigured" }, 500),
    };
  }
  return { ok: true, env: { url, anonKey } };
}

// ─── User auth ──────────────────────────────────────────────────────

export type AuthedUser = {
  id: string;
  email: string | null;
  emailLower: string | null;
  phone: string | null;
  // The underlying Supabase user object — never null on the success
  // path because getAuthedUser bails before returning if data.user is
  // missing.
  raw: User;
};

// Shared shaping so getAuthedUser and getOptionalAuthedUser stay in lockstep.
function shapeAuthedUser(raw: User): AuthedUser {
  return {
    id: raw.id,
    email: raw.email ?? null,
    emailLower: raw.email?.toLowerCase() ?? null,
    phone: raw.phone ?? null,
    raw,
  };
}

export async function getAuthedUser(
  req: Request,
  env: EFEnv,
): Promise<
  | { ok: true; user: AuthedUser }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: json({ ok: false, error: "Missing bearer token" }, 401),
    };
  }
  const userClient = createClient(env.url, env.anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return {
      ok: false,
      response: json({ ok: false, error: "Invalid session" }, 401),
    };
  }
  return { ok: true, user: shapeAuthedUser(data.user) };
}

// Anonymous-OK variant for public facades (discovery decks, catalog,
// place suggestions) where a signed-in caller gets personalization but an
// anonymous caller is still served. Never returns a 401: a missing or
// invalid bearer simply yields `user: null`.
//
//   const { user } = await getOptionalAuthedUser(req, env);
//   if (user) { /* personalize */ }
export async function getOptionalAuthedUser(
  req: Request,
  env: EFEnv | AnonEnv,
): Promise<{ user: AuthedUser | null }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { user: null };
  }
  const userClient = createClient(env.url, env.anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return { user: null };
  }
  return { user: shapeAuthedUser(data.user) };
}

// ─── Admin client ───────────────────────────────────────────────────

export function adminClient(env: EFEnv): SupabaseClient {
  return createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── Anon client ────────────────────────────────────────────────────

// RLS-scoped anonymous client for PUBLIC read EFs (catalog, place detail,
// tag/category vocabularies). Row visibility rests entirely on the anon
// RLS policies — this client can never read past them. Counterpart to
// `adminClient`; pairs with `readAnonEnv`. (EFEnv is structurally
// assignable to AnonEnv, so full-env EFs can call this too.)
export function anonClient(env: AnonEnv): SupabaseClient {
  return createClient(env.url, env.anonKey);
}

// ─── Super-admin (re-export — implementation in auth-super-admin.ts) ─

export { checkSuperAdmin, requireSuperAdmin } from "./auth-super-admin.ts";

// ─── Admin request opening ─────────────────────────────────────────

export type AdminRequest = {
  env: EFEnv;
  admin: SupabaseClient;
  user: AuthedUser;
};

// The opening every admin-web-* EF shares, in this order: CORS preflight,
// method, env (500), bearer session (401), service-role client, then the
// super_admins gate (401 no identity / 403 with `forbiddenMessage`). Each
// failure is the exact Response the inline sequence returned. Callers:
//
//   const ctx = await requireAdminRequest(req, "POST");
//   if (ctx instanceof Response) return ctx;
//   const { env, admin, user } = ctx;
export async function requireAdminRequest(
  req: Request,
  method: string,
  forbiddenMessage?: string,
): Promise<AdminRequest | Response> {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, method);
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user, forbiddenMessage);
  if (!saRes.ok) return saRes.response;
  return { env: envRes.env, admin, user: authRes.user };
}
