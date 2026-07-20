// Shared Edge Function invoker — ported verbatim from apps/web-consumer
// src/lib/api/_invoke.ts (it only depends on supabase-js, so it works
// unchanged in React Native).
//
// Every apiXxx() helper wraps `client.functions.invoke` and runs the same
// three checks: transport error → unwrap the EF body for a real message;
// otherwise throw the EF's `error` field; otherwise return the `data`.

import type { SupabaseClient } from '@supabase/supabase-js';

import { addEfBreadcrumb, sentryEnabled, Sentry } from '@/lib/sentry';

// The shape every EF returns. Discriminated on `ok` so TypeScript narrows
// correctly after the helper's success check.
type EFResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string | null };

// Thrown by invokeEF for every failure (transport non-2xx OR `ok: false`).
// Carries the EF's machine-readable `code`, the HTTP `status` (when the
// failure came with a Response), and the full parsed error body so call sites
// can branch (e.g. status === 404, code === "place_already_exists") without
// re-implementing the raw-invoke unwrap themselves.
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
    this.name = 'EFError';
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
  fallback = `${fn} failed`,
): Promise<T> {
  addEfBreadcrumb({ fn, level: 'info', message: `invoke ${fn}` });

  const { data, error } = await client.functions.invoke<EFResult<T>>(fn, {
    body,
  });

  if (error) {
    const parsed = await parseInvokeErrorBody(error);
    const message = pickErrorMessage(parsed) ?? error.message;
    const code = parsed && typeof parsed.code === 'string' ? parsed.code : null;
    const status = readInvokeStatus(error);
    addEfBreadcrumb({
      fn,
      level: 'error',
      status,
      code,
      message,
    });
    if (sentryEnabled) {
      Sentry.captureException(
        new EFError(message, { fn, code, status, body: parsed }),
      );
    }
    throw new EFError(message, {
      fn,
      code,
      status,
      body: parsed,
    });
  }
  if (!data) {
    addEfBreadcrumb({ fn, level: 'error', message: fallback });
    throw new EFError(fallback, { fn });
  }
  if (!data.ok) {
    const message = data.error ?? fallback;
    const code = data.code ?? null;
    addEfBreadcrumb({ fn, level: 'error', code, message });
    throw new EFError(message, {
      fn,
      code,
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
// `error.context` — that field IS the Response, not `{ response }`.
async function parseInvokeErrorBody(
  error: unknown,
): Promise<Record<string, unknown> | null> {
  try {
    const res = (error as { context?: Response }).context;
    if (!res || typeof res.clone !== 'function') return null;
    const json = await res
      .clone()
      .json()
      .catch(() => null);
    if (json && typeof json === 'object') return json as Record<string, unknown>;
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
  return typeof msg === 'string' && msg.length > 0 ? msg : null;
}

// The FunctionsHttpError's Response (on `.context`) carries the HTTP status.
// Returns null when there's no readable Response (network failure).
function readInvokeStatus(error: unknown): number | null {
  const res = (error as { context?: Response }).context;
  return res && typeof res.status === 'number' ? res.status : null;
}
