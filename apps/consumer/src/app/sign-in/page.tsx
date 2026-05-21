import { redirect } from "next/navigation";

// Auth lives at the subdomain root now. /sign-in stays as a redirect so
// saved URLs and any external callbacks that point here keep working —
// we forward whatever `next` they carry.

export const dynamic = "force-dynamic";

export default async function LegacySignInRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  redirect(params.next ? `/?next=${encodeURIComponent(params.next)}` : "/");
}
