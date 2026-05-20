import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiManagerSigninEmail } from "@/lib/api/auth";

// Post-sign-in router. The sign-in surface redirects here. We:
//
//   1. Call the manager post-sign-in EF (stamps app_metadata.role,
//      lazy-creates the profile row).
//   2. Decide where to send the user — /onboard if the profile row is
//      missing required fields, / (root smart-redirect to /unit/<id>/home)
//      otherwise.
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

  let result: Awaited<ReturnType<typeof apiManagerSigninEmail>> | null = null;
  try {
    result = await apiManagerSigninEmail(supabase);
  } catch (err) {
    console.error("[post-signin] manager-signin-email:", err);
  }
  if (explicitNext) redirect(explicitNext);
  redirect(result?.onboarded ? "/" : "/onboard");
}
