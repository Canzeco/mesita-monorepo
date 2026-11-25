import { createClient, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { fetch as expoFetch } from "expo/fetch";
import { AppState } from "react-native";

import { env } from "@/lib/env";
import { secret } from "@/lib/storage";

// Supabase Auth only: phone sign-in and the session. Functions are called by
// callEdge, and the database by nobody.

const SESSION = "mesita.session";

/** Auth drops the session on any refusal it calls final, a 500 and a 429
 *  among them. Only a real refusal may sign a guest out, so an answer that
 *  says "not now" is turned into what it is: a network failure. */
export async function authFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const res = await (expoFetch as unknown as typeof fetch)(input, init);
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const refreshing = url.includes("grant_type=refresh_token");
  if (refreshing && (res.status >= 500 || res.status === 429)) {
    throw new TypeError(`Network request failed (auth ${res.status})`);
  }
  return res;
}

export const supabase = createClient(env.supabaseUrl, env.supabaseKey, {
  auth: {
    storage: { getItem: secret.get, setItem: secret.set, removeItem: secret.remove },
    storageKey: SESSION,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: authFetch },
});

/** Refreshing follows the front: a suspended phone must not run timers. */
export function followAppState(): () => void {
  const sync = (state: string | null | undefined) =>
    void (state === "active" ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh());
  sync(AppState.currentState);
  const sub = AppState.addEventListener("change", sync);
  return () => sub.remove();
}

/** The guest of the session on this device, with no network. */
export async function storedGuestId(): Promise<string | null> {
  const raw = await secret.get(SESSION);
  if (!raw) return null;
  try {
    const id = (JSON.parse(raw) as { user?: { id?: unknown } }).user?.id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

export type Token = { kind: "member"; token: string } | { kind: "anonymous" } | { kind: "unreachable" };

/** The token to call with. A member whose token could not be refreshed for
 *  the network is never sent as anonymous. */
export async function currentToken(): Promise<Token> {
  const { data, error } = await supabase.auth.getSession();
  if (data.session) return { kind: "member", token: data.session.access_token };
  if (error && isAuthRetryableFetchError(error)) return { kind: "unreachable" };
  return { kind: "anonymous" };
}

let refreshing: Promise<Token> | null = null;

/** One refresh at a time: parallel 401s share it. */
export function refreshToken(): Promise<Token> {
  refreshing ??= supabase.auth
    .refreshSession()
    .then(({ data, error }): Token => {
      if (data.session) return { kind: "member", token: data.session.access_token };
      return error && isAuthRetryableFetchError(error) ? { kind: "unreachable" } : { kind: "anonymous" };
    })
    .catch((): Token => ({ kind: "unreachable" }))
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Forget the session on this device. "local" ends no other device's. */
export async function dropSession(): Promise<void> {
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  await secret.remove(SESSION);
}
