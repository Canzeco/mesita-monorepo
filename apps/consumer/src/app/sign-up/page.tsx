import { redirect } from "next/navigation";

// Phone OTP collapses sign-in and sign-up into one flow. /sign-up exists
// only as a redirect to the root auth surface, preserving any inbound
// links from marketing CTAs / bookmarks.

export const dynamic = "force-dynamic";

export default async function LegacySignUpRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  redirect(params.next ? `/?next=${encodeURIComponent(params.next)}` : "/");
}
