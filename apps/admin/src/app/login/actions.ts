"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  timingSafeEqual,
} from "@/lib/auth";

function safeNext(raw: string | undefined): string {
  if (!raw) return "/";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

// Verify the submitted password against ADMIN_PASSWORD and set the
// session cookie on success. Bounces back to /login?error=... on the
// failure paths so the login UI can render an inline message.
export async function authLogin(next: string, formData: FormData) {
  const submitted = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    redirect("/login?error=unconfigured");
  }

  if (!submitted || !timingSafeEqual(submitted, expected)) {
    redirect("/login?error=wrong");
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect(safeNext(next));
}

export async function authLogout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
