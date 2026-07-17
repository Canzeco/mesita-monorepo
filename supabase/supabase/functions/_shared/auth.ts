// Auth helpers shared by every business-* Edge Function on the Team
// surface (and reusable anywhere else that needs env/user/client setup).
//
// The three EF entry-points always look the same:
//
//   1. Read SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY → 500 if missing
//   2. Verify Bearer JWT → resolve auth.user → 401 if missing/invalid
//   3. (Optionally) confirm the user is a member of a place, possibly
//      with role ≥ X, with super_admins as a bypass — 403 otherwise
//
// Membership helpers (step 3) live in auth-membership.ts and are
// re-exported below so callers keep importing from this module.

import {
  createClient,
  type SupabaseClient,
  type User,
} from "jsr:@supabase/supabase-js@2";
import { json } from "./http.ts";

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
  appRole: string | null;
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
    appRole: ((raw.app_metadata as Record<string, unknown> | null)?.role as
      | string
      | undefined) ?? null,
    raw,
  };
}

export async function getAuthedUser(
  req: Request,
  env: EFEnv,
): Promise<
  | { ok: true; user: AuthedUser; userClient: SupabaseClient }
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
  return { ok: true, userClient, user: shapeAuthedUser(data.user) };
}

// Anonymous-OK variant for public facades (discovery decks, catalog,
// place suggestions) where a signed-in caller gets personalization but an
// anonymous caller is still served. Never returns a 401: a missing or
// invalid bearer simply yields `user: null`. When a valid session IS
// present, the RLS-scoped `userClient` is returned so the handler can read
// the caller's own rows.
//
//   const { user, userClient } = await getOptionalAuthedUser(req, env);
//   if (user && userClient) { /* personalize */ }
export async function getOptionalAuthedUser(
  req: Request,
  env: EFEnv | AnonEnv,
): Promise<{ user: AuthedUser | null; userClient: SupabaseClient | null }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { user: null, userClient: null };
  }
  const userClient = createClient(env.url, env.anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return { user: null, userClient: null };
  }
  return { user: shapeAuthedUser(data.user), userClient };
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

// ─── Membership (re-export — implementation in auth-membership.ts) ──

export {
  checkMembership,
  checkSuperAdmin,
  requireSuperAdmin,
  requireMembership,
  requireOwner,
} from "./auth-membership.ts";
