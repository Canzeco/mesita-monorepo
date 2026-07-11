import { createServerSupabase } from "@/lib/supabase/server";

// Server-side helper for calling Supabase Edge Functions from the admin
// app. Auth is the operator's Supabase session (Google OAuth) — the
// JWT is attached automatically by supabase-js. The EFs check the JWT's
// email against public.super_admins.
//
// Error handling is Result-style (never throws): callers branch on `.ok`.
// The consumer/business apps use a typed-throwing `EFError`
// ({ code, status, fn, body }); admin keeps a deliberate Result-style
// equivalent because every call site here already branches on `.ok`
// (throwing would force a try/catch around ~15 sites). The failure
// object carries the SAME machine-readable fields as EFError so call
// sites can branch on a `code` (e.g. "place_already_exists") without
// re-parsing `.data` — see EFFailure below.

/** Machine-readable failure, mirroring EFError's { code, status, fn, body }. */
export type EFFailure = {
  ok: false;
  /** HTTP status from the EF response, or 0 for transport/init errors. */
  status: number;
  /** EF's machine-readable error code (body.code), or null if absent. */
  code: string | null;
  /** The invoked edge-function name. */
  fn: string;
  /** Human-readable message (EF body.error, else a synthesised fallback). */
  error: string;
  /** The parsed error body (EFError's `body`), or null. */
  data: unknown;
};

type InvokeResult<T> = { ok: true; status: number; data: T } | EFFailure;

export async function efInvoke<T>(
  fnName: string,
  body: unknown,
): Promise<InvokeResult<T>> {
  let supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  try {
    supabase = await createServerSupabase();
  } catch (err) {
    return {
      ok: false,
      status: 500,
      code: null,
      fn: fnName,
      error: err instanceof Error ? err.message : "Supabase client init failed.",
      data: null,
    };
  }

  const { data: parsed, error } = await supabase.functions.invoke<unknown>(
    fnName,
    { body: body as Record<string, unknown> },
  );

  if (error) {
    // FunctionsHttpError stashes the original Response on .context. Peel
    // off the EF's `{ ok: false, error, code }` body for a useful message.
    const ctx = (error as { context?: Response }).context;
    let inner: unknown = null;
    if (ctx && typeof ctx.clone === "function") {
      inner = await ctx
        .clone()
        .json()
        .catch(() => null);
      if (!inner) {
        const text = await ctx
          .clone()
          .text()
          .catch(() => "");
        if (text) inner = { error: text.slice(0, 500) };
      }
    }
    const innerError =
      inner && typeof inner === "object" && "error" in inner
        ? String((inner as { error: unknown }).error)
        : null;
    const code =
      inner &&
      typeof inner === "object" &&
      "code" in inner &&
      typeof (inner as { code: unknown }).code === "string"
        ? ((inner as { code: string }).code)
        : null;
    const status =
      ctx && typeof ctx.status === "number" ? ctx.status : 0;
    return {
      ok: false,
      status,
      code,
      fn: fnName,
      error:
        innerError ??
        (status ? `${fnName} failed (HTTP ${status})` : null) ??
        error.message ??
        `EF ${fnName} failed`,
      data: inner,
    };
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { ok?: unknown }).ok !== true
  ) {
    const errMsg =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : `EF ${fnName} returned no ok body`;
    const code =
      parsed &&
      typeof parsed === "object" &&
      "code" in parsed &&
      typeof (parsed as { code: unknown }).code === "string"
        ? ((parsed as { code: string }).code)
        : null;
    return { ok: false, status: 0, code, fn: fnName, error: errMsg, data: parsed };
  }

  return { ok: true, status: 200, data: parsed as T };
}
