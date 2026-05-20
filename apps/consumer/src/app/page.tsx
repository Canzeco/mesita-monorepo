import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

// Route guests to the right starting point based on whether they have a
// session yet. Signed in → discover. Signed out → sign-in (which will
// bounce them to discover once auth lands).
export const dynamic = "force-dynamic";

export default async function GuestIndexPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/discover/swipe" : "/sign-in");
}
