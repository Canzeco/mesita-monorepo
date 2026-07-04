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
type EFResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string | null };

// Thrown by invokeEF for every failure (transport non-2xx OR `ok: false`).
// Carries the EF's machine-readable `code`, the HTTP `status` (when the
// failure came with a Response), and the full parsed error body so call sites
// can branch (e.g. status === 404, code === "place_already_exists") without
// re-implementing the raw-invoke unwrap themselves. `status` is null on the
// `ok: false` arm (a 2xx body, no Response to read a status from).
export class EFError extends Error {
  readonly code: string | null;
  readonly status: number | null;
  readonly fn: string;
  readonly body: Record<string, unknown> | null;

  constructor(
    message: string,
    opts: {
      fn: string;
      code?: string | null;
      status?: number | null;
      body?: Record<string, unknown> | null;
    },
  ) {
    super(message);
    this.name = "EFError";
    this.code = opts.code ?? null;
    this.status = opts.status ?? null;
    this.fn = opts.fn;
    this.body = opts.body ?? null;
  }
}

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
    const parsed = await parseInvokeErrorBody(error);
    const message = pickErrorMessage(parsed) ?? error.message;
    const code =
      parsed && typeof parsed.code === "string" ? parsed.code : null;
    throw new EFError(message, {
      fn,
      code,
      status: readInvokeStatus(error),
      body: parsed,
    });
  }
  if (!data) {
    throw new EFError(fallback, { fn });
  }
  if (!data.ok) {
    throw new EFError(data.error ?? fallback, {
      fn,
      code: data.code ?? null,
      body: data as Record<string, unknown>,
    });
  }
  // After the ok check TS narrows away the failure arm; drop the
  // discriminator before returning.
  const { ok: _ok, ...rest } = data;
  return rest as T;
}

// supabase-js wraps non-2xx responses in a FunctionsHttpError whose default
// `.message` is the generic "Edge Function returned a non-2xx status code".
// The real body (the EF's `{ ok: false, error, code, … }`) lives directly on
// `error.context` — that field IS the Response, not `{ response }`. Peel it
// off (JSON preferred; short plain-text fallback) so both the message and any
// structured fields survive.
async function parseInvokeErrorBody(
  error: unknown,
): Promise<Record<string, unknown> | null> {
  try {
    const res = (error as { context?: Response }).context;
    if (!res || typeof res.clone !== "function") return null;
    const json = await res
      .clone()
      .json()
      .catch(() => null);
    if (json && typeof json === "object") return json as Record<string, unknown>;
    const text = await res
      .clone()
      .text()
      .catch(() => null);
    if (text && text.length > 0 && text.length < 500) return { error: text };
    return null;
  } catch {
    return null;
  }
}

function pickErrorMessage(body: Record<string, unknown> | null): string | null {
  const msg = body?.error;
  return typeof msg === "string" && msg.length > 0 ? msg : null;
}

// The FunctionsHttpError's Response (on `.context`) carries the HTTP status —
// e.g. 404 for a not-found, 401 for an expired session. Returns null when
// there's no readable Response (network failure before a response arrived).
function readInvokeStatus(error: unknown): number | null {
  const res = (error as { context?: Response }).context;
  return res && typeof res.status === "number" ? res.status : null;
}
