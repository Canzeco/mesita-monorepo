"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

// Sign-out server action. The magic-link sign-in itself runs client-side
// via supabase.auth.signInWithOtp (browser client + redirectTo) — see
// MagicLinkForm. Sign-out goes through the server so the SSR cookie is
// cleared atomically, then we bounce to /login.
export async function authLogout() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
