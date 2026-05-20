import { getAdminKey } from "@/lib/admin-key";

// Server-side helper for calling Supabase Edge Functions from the admin
// app's route handlers and server actions. Two pieces of auth ride on
// every call:
//
//   - `Authorization: Bearer <anon-key>` — required by Supabase's
//     gateway to route the request to the function, even for functions
//     with `verify_jwt = false`. This is the same anon key the public
//     guest reads use; it is not a secret.
//   - `x-admin-key: <operator-entered key>` — Mesita's own gate. The
//     function compares it against `ADMIN_ACCESS_KEY` in Supabase
//     secrets and returns 401 if missing or wrong.
//
// Reads `SUPABASE_URL` + `SUPABASE_ANON_KEY` from server env (NOT
// `NEXT_PUBLIC_*` — these never need to ship to the browser).

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";

export type InvokeResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; data: unknown };

export async function efInvoke<T>(
  fnName: string,
  body: unknown,
): Promise<InvokeResult<T>> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      ok: false,
      status: 500,
      error:
        "Admin app is missing SUPABASE_URL / SUPABASE_ANON_KEY. Set them in Vercel env.",
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
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
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
