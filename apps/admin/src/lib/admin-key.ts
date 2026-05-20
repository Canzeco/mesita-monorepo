import { cookies } from "next/headers";

// Where the admin key lives in the browser. HttpOnly so client JS
// can't read it; only server actions / route handlers can attach it
// to outgoing Edge Function calls.
export const ADMIN_KEY_COOKIE = "mesita_admin_key";
export const ADMIN_KEY_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

// The admin app does NOT validate the key itself — it just stores it
// and forwards it on every privileged call. The Supabase Edge Function
// at the other end compares it against the ADMIN_ACCESS_KEY secret and
// either does the work or returns 401. Pattern:
//
//   const key = await getAdminKey();
//   const res = await fetch(EF_URL, {
//     method: "POST",
//     headers: { "x-admin-key": key ?? "" },
//     body: JSON.stringify(...)
//   });
//   if (res.status === 401) { ...prompt operator to re-enter at /login... }
//
// That way the key never leaves the server-side request; client JS
// never sees it (HttpOnly cookie), and replaying the cookie alone is
// useless without also hitting an admin EF that validates it.
export async function getAdminKey(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ADMIN_KEY_COOKIE)?.value ?? null;
}
