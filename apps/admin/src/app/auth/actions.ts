"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

// Sign-out server action wired to the Sidebar's "Sign out" button.
// Clears the Supabase session cookie and bounces back to /.
export async function authSignOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/");
}
