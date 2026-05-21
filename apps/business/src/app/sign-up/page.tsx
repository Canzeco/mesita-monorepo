import { redirect } from "next/navigation";

// Auth lives at the subdomain root now. /sign-up forwards to `?mode=signup`
// so the AuthTabs control on `/` lands directly on the create-account tab.
// Keeps external links / marketing CTAs that point here from breaking.

export const dynamic = "force-dynamic";

export default async function LegacySignUpRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams({ mode: "signup" });
  if (params.next) qs.set("next", params.next);
  redirect(`/?${qs.toString()}`);
}
