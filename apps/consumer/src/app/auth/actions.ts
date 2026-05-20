"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

// Guest auth is phone-OTP only — that flow runs client-side in
// PhoneOtpForm via the browser Supabase client, so no email/password
// server action is needed here. The only server-side action left is
// signing out (clears the SSR cookie), invoked from SignOutButton.

type AuthFormState = {
  error?: string;
  info?: string;
} | null;

export async function authSignOut(redirectTo: string, _formData: FormData) {
  void _formData;
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(redirectTo);
}
