import { getAdminKey } from "@/lib/admin-key";

// Server-side helper for calling Supabase Edge Functions from the admin
// app. Admin EFs are deployed with `verify_jwt = false` — the gateway
// lets the request through without any project key — and gate themselves
// on the `x-admin-key` header (compared against `ADMIN_ACCESS_KEY` in
// Supabase secrets). The admin key arrives here from an HttpOnly cookie
// set at /login, so it never touches the browser-side JS.
//
// Only `NEXT_PUBLIC_SUPABASE_URL` is needed in env.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

type InvokeResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; data: unknown };

export async function efInvoke<T>(
  fnName: string,
  body: unknown,
): Promise<InvokeResult<T>> {
  if (!SUPABASE_URL) {
    return {
      ok: false,
      status: 500,
      error: "Admin app is missing NEXT_PUBLIC_SUPABASE_URL. Set it in Vercel env.",
      data: null,
    };
  }

  const adminKey = await getAdminKey();
  if (!adminKey) {
    return {
      ok: false,
      status: 401,
      error: "Admin key is not set on this device. Go to /login to enter one.",
      data: null,
    };
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    return {
      ok: false,
      status: res.status,
      error: `EF ${fnName} returned non-JSON body: ${text.slice(0, 200)}`,
      data: null,
    };
  }

  const okFromBody =
    parsed !== null &&
    typeof parsed === "object" &&
    (parsed as { ok?: unknown }).ok === true;

  if (!okFromBody) {
    const errMsg =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : `EF ${fnName} failed with HTTP ${res.status}`;
    return { ok: false, status: res.status, error: errMsg, data: parsed };
  }

  return { ok: true, status: res.status, data: parsed as T };
}
