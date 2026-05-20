import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  apiAdminSigninEmail,
  apiGuestSigninPhone,
  apiManagerSigninEmail,
} from "@/lib/api/auth";

// Post-sign-in router. The four sign-in surfaces redirect here with
// ?audience=guest|manager|admin. We then:
//
//   1. Call the matching post-sign-in EF (stamps app_metadata.role,
//      lazy-creates the profile row, runs admin gates).
//   2. Decide where to send the user — onboard if the profile row is
//      missing required fields, the role's home otherwise.
//
// Why a dedicated server page: it runs server-side with the session
// cookie, so the EF call carries the freshly-issued JWT and any errors
// land in our SSR error path instead of leaking to the client.

export const dynamic = "force-dynamic";

type Audience = "guest" | "manager" | "admin";

export default async function PostSigninPage({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string; next?: string }>;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/manager/sign-in");

  const params = await searchParams;
  const audience = parseAudience(params.audience);
  const explicitNext =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : null;

  if (audience === "admin") {
    try {
      await apiAdminSigninEmail(supabase);
    } catch (err) {
      // Admin gates failed (@canzeco.com or MFA). Push back to the
      // sign-in page with a banner — the EF already revoked the session
      // for the wrong-domain case, so the user is now signed out.
      const message = err instanceof Error ? err.message : "Admin gate failed.";
      redirect(`/admin/sign-in?error=${encodeURIComponent(message)}`);
    }
    redirect(explicitNext ?? "/admin");
  }

  if (audience === "manager") {
    let result: Awaited<ReturnType<typeof apiManagerSigninEmail>> | null = null;
    try {
      result = await apiManagerSigninEmail(supabase);
    } catch (err) {
      console.error("[post-signin] manager-signin-email:", err);
    }
    if (explicitNext) redirect(explicitNext);
    redirect(result?.onboarded ? "/manager/home" : "/manager/onboard");
  }

  // Default = guest.
  let guestResult: Awaited<ReturnType<typeof apiGuestSigninPhone>> | null =
    null;
  try {
    guestResult = await apiGuestSigninPhone(supabase);
  } catch (err) {
    console.error("[post-signin] guest-signin-phone:", err);
  }
  if (explicitNext) redirect(explicitNext);
  redirect(guestResult?.onboarded ? "/guest/discover/swipe" : "/guest/onboard");
}

function parseAudience(raw: string | undefined): Audience {
  if (raw === "admin" || raw === "manager") return raw;
  return "guest";
}
