import { redirect } from "next/navigation";

// Auth lives at the subdomain root now. /login forwards there so any
// saved bookmarks / OAuth provider redirect URLs keep working.

export const dynamic = "force-dynamic";

export default async function LegacyLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  redirect(params.error ? `/?error=${encodeURIComponent(params.error)}` : "/");
}
