"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

// Consumer auth is phone-OTP only — that flow runs client-side in
// PhoneOtpForm via the browser Supabase client, so no email/password
// server action is needed here. The only server-side action left is
// signing out (clears the SSR cookie), invoked from SignOutButton.
//
// SignOutButton renders <form action={authSignOut.bind(null, "/")}> so
// React passes the FormData as the trailing arg — we accept it just to
// match the form-action signature and never read it.
export async function authSignOut(redirectTo: string, _formData: FormData) {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(redirectTo);
}
