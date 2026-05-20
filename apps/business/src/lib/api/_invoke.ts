// Shared Edge Function invoker.
//
// Every apiXxx() helper in this directory wraps `client.functions.invoke`
// and runs the same three checks: transport error → unwrap the EF body for
// a real message; otherwise throw the EF's `error` field; otherwise return
// the `data`. Centralising the pattern means:
//   • all helpers report the actual EF error (not "Edge Function returned
//     a non-2xx status code", which is the supabase-js default for the
//     FunctionsHttpError wrapper),
//   • new helpers don't get to forget the unwrap step,
//   • one place to evolve the contract (telemetry, retry, etc.).

import type { SupabaseClient } from "@supabase/supabase-js";

// The shape every EF returns. Discriminated on `ok` so TypeScript narrows
// correctly after the helper's success check.
export type EFResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string | null };

export async function invokeEF<T>(
  client: SupabaseClient,
  fn: string,
  body: Record<string, unknown>,
  // Surfaced in the thrown error when the EF returns `ok: false` with no
  // `error` string. Useful for less obvious EFs whose default message
  // wouldn't be readable on its own.
  fallback = `${fn} failed`,
): Promise<T> {
  const { data, error } = await client.functions.invoke<EFResult<T>>(fn, {
    body,
  });

  if (error) {
    const inner = await readInvokeError(error);
    throw new Error(inner ?? error.message);
  }
  if (!data) {
    throw new Error(fallback);
  }
  if (!data.ok) {
    throw new Error(data.error ?? fallback);
  }
  // After the ok check TS narrows away the failure arm.
  const { ok: _ok, ...rest } = data;
  void _ok;
  return rest as T;
}

// supabase-js wraps non-2xx responses in a FunctionsHttpError whose default
// `.message` is the generic "Edge Function returned a non-2xx status code".
// The real body (the EF's `{ ok: false, error: "…" }`) lives directly on
// `error.context` — that field IS the Response, not `{ response }`. Peel it
// off so the UI gets a useful message.
export async function readInvokeError(error: unknown): Promise<string | null> {
  try {
    const res = (error as { context?: Response }).context;
    if (!res || typeof res.clone !== "function") return null;
    const body = await res
      .clone()
      .json()
      .catch(() => null);
    if (body && typeof body === "object" && "error" in body) {
      const msg = (body as { error?: string }).error;
      if (typeof msg === "string" && msg.length > 0) return msg;
    }
    const text = await res
      .clone()
      .text()
      .catch(() => null);
    if (text && text.length < 500) return text;
    return null;
  } catch {
    return null;
  }
}
