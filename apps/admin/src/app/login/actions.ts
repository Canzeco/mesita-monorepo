"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_KEY_COOKIE,
  ADMIN_KEY_MAX_AGE_SECONDS,
} from "@/lib/admin-key";

function safeNext(raw: string | undefined): string {
  if (!raw) return "/";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

// Stores the operator's admin key in an HttpOnly cookie. The key
// itself is never validated here — the Supabase Edge Functions
// downstream validate it on every privileged call (comparing against
// ADMIN_ACCESS_KEY in Supabase Function secrets). If the key is wrong,
// the operator will see action errors on the actual pages.
export async function authStoreKey(next: string, formData: FormData) {
  const key = String(formData.get("key") ?? "").trim();
  if (!key) {
    redirect("/login?error=missing_key");
  }

  const jar = await cookies();
  jar.set(ADMIN_KEY_COOKIE, key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_KEY_MAX_AGE_SECONDS,
  });

  redirect(safeNext(next));
}

export async function authClearKey() {
  const jar = await cookies();
  jar.delete(ADMIN_KEY_COOKIE);
  redirect("/login");
}
