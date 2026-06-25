import { createServerSupabase } from "@/lib/supabase/server";

// Server-side helper for calling Supabase Edge Functions from the admin
// app. Auth is the operator's Supabase session (Google OAuth) — the
// JWT is attached automatically by supabase-js. The EFs check the JWT's
// email against public.super_admins.

type InvokeResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; data: unknown };

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
    // off the EF's `{ ok: false, error }` body for a useful message.
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
    const status =
      ctx && typeof ctx.status === "number" ? ctx.status : 0;
    return {
      ok: false,
      status,
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
    return { ok: false, status: 0, error: errMsg, data: parsed };
  }

  return { ok: true, status: 200, data: parsed as T };
}
