import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiGuestSigninPhone } from "@/lib/api/auth";

// Post-sign-in router. The sign-in surface redirects here. We:
//
//   1. Call the guest post-sign-in EF (stamps app_metadata.role,
//      lazy-creates the profile row).
//   2. Decide where to send the user — /onboard if the profile row is
//      missing required fields, /discover/swipe otherwise.
//
// Why a dedicated server page: it runs server-side with the session
// cookie, so the EF call carries the freshly-issued JWT and any errors
// land in our SSR error path instead of leaking to the client.

export const dynamic = "force-dynamic";

export default async function PostSigninPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const params = await searchParams;
  const explicitNext =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : null;

  let guestResult: Awaited<ReturnType<typeof apiGuestSigninPhone>> | null =
    null;
  try {
    guestResult = await apiGuestSigninPhone(supabase);
  } catch (err) {
    console.error("[post-signin] guest-signin-phone:", err);
  }
  if (explicitNext) redirect(explicitNext);
  redirect(guestResult?.onboarded ? "/discover/swipe" : "/onboard");
}
