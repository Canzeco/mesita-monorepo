"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/auth";

function safeNext(raw: string | undefined): string {
  if (!raw) return "/";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

// Sign-in. The form sends just a password — the email is fixed
// (ADMIN_EMAIL) and never exposed to the operator. Supabase verifies
// the password and sets the standard SSR session cookies; the
// middleware then checks app_metadata.role === "admin" on every
// request, so a non-admin who somehow gets the password to the admin
// account still wouldn't get past the gate (though there's only one
// admin user, so practically the password IS the gate).
export async function authSignInWithToken(next: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!password) {
    redirect("/login?error=missing_token");
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password,
  });

  if (error) {
    redirect("/login?error=invalid_token");
  }

  redirect(safeNext(next));
}

export async function authLogout() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
