"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_KEY_COOKIE,
  ADMIN_KEY_MAX_AGE_SECONDS,
} from "@/lib/admin-key";
import { safeNext } from "@/lib/safe-next";

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
