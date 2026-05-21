import { redirect } from "next/navigation";

// Auth lives at the subdomain root now. /sign-in is kept as a redirect
// so saved URLs, marketing copy, and post-redirect callbacks that point
// here keep working — we forward whatever `next` they carry.

export const dynamic = "force-dynamic";

export default async function LegacySignInRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.next) qs.set("next", params.next);
  if (params.error) qs.set("error", params.error);
  const tail = qs.toString();
  redirect(tail ? `/?${tail}` : "/");
}
