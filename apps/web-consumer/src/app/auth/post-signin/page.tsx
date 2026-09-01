import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { apiConsumerSigninPhone } from "@/lib/api/auth";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { safeNextPath, withNext } from "@/lib/auth-redirect";
import { errMsg } from "@/lib/utils";

// Post-sign-in router. The sign-in surface redirects here. We:
//
//   1. Call the consumer post-sign-in EF (stamps app_metadata.role,
//      lazy-creates the profile row).
//   2. Decide where to send the user — /onboard if the profile row is
//      missing required fields, /home/swipe otherwise.
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
  if (!user) redirect("/");

  const params = await searchParams;
  const explicitNext = safeNextPath(params.next);

  let consumerResult: Awaited<
    ReturnType<typeof apiConsumerSigninPhone>
  > | null = null;
  try {
    consumerResult = await apiConsumerSigninPhone(supabase);
  } catch (err) {
    console.error(
      "[post-signin] consumer-signin-phone:",
      errMsg(err, "signin failed"),
    );
  }
  // Onboarding wins over the deep link, but doesn't eat it: an unfinished
  // profile goes to /onboard carrying the target, and the form sends them
  // on once it's saved. Sending them to the target first only bounced them
  // back off the (shell) gate with the destination already lost.
  if (!consumerResult?.onboarded) {
    redirect(withNext(CONSUMER_ROUTES.onboard, explicitNext));
  }
  redirect(explicitNext ?? CONSUMER_ROUTES.search);
}
