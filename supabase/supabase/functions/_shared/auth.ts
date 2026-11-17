// Auth helpers shared by every Edge Function: env, the bearer's user, and
// the service-role and anon clients. The doors that compose them, one per
// caller, are in request.ts.

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
  // The underlying Supabase user object — never null on the success
  // path because getAuthedUser bails before returning if data.user is
  // missing.
  raw: User;
};

// Shared shaping so getAuthedUser and getOptionalAuthedUser stay in lockstep.
// Auth hands a Google or email session `phone: ""` (and a phone session
// `email: ""`), so a blank is null here: every EF sees null, never "" (a ""
// written to consumers.phone reads as a number that isn't one, MESITA-3777).
export function shapeAuthedUser(raw: User): AuthedUser {
  const email = raw.email || null;
  return {
    id: raw.id,
    email,
    emailLower: email?.toLowerCase() ?? null,
    phone: raw.phone || null,
    raw,
  };
}

/** The token after `Bearer `, trimmed, or null when there isn't one. */
export function bearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim() || null;
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

// ─── Anonymous or member (MESITA-4246) ──────────────────────────────
//
// Anonymous mode: a visitor with no session browses Social and a place's
// likes line. Unlike getOptionalAuthedUser, a BROKEN session is not
// anonymous: it is a 401 `session_invalid`, so an expired member is never
// silently served the reduced, anonymous view.
//
//   no Authorization, the bearer is the project key (the app sends it when
//   there is no session), or a JWT whose role is `anon`  → anonymous
//   any other bearer that auth accepts                   → member
//   any other bearer                                     → 401

/** The `role` claim of a JWT, or null. Never verifies: the gateway or
 *  auth.getUser does that. */
export function jwtRole(token: string): string | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/** Whether the bearer is no person at all (pure). */
export function isAnonymousBearer(token: string | null, req: Request, anonKey: string): boolean {
  if (!token) return true;
  if (token === anonKey) return true;
  const apikey = (req.headers.get("apikey") ?? "").trim();
  if (apikey && token === apikey) return true;
  return jwtRole(token) === "anon";
}

export async function classifyCaller(
  req: Request,
  env: EFEnv | AnonEnv,
): Promise<
  | { ok: true; user: AuthedUser | null }
  | { ok: false; response: Response }
> {
  const token = bearerToken(req);
  if (isAnonymousBearer(token, req, env.anonKey)) return { ok: true, user: null };
  const userClient = createClient(env.url, env.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return {
      ok: false,
      response: json({ ok: false, code: "session_invalid", error: "Invalid session" }, 401),
    };
  }
  if (data.user.is_anonymous) return { ok: true, user: null };
  return { ok: true, user: shapeAuthedUser(data.user) };
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
