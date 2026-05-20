import { cookies } from "next/headers";

// HttpOnly so client JS can't read it — only server actions and route
// handlers can attach the key to outgoing Edge Function calls.
export const ADMIN_KEY_COOKIE = "mesita_admin_key";
export const ADMIN_KEY_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function getAdminKey(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ADMIN_KEY_COOKIE)?.value ?? null;
}
