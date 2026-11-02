import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getIdentity } from "@/lib/business-api";
import { NEXT_COOKIE, safeNextPath } from "@/lib/safe-next";

// Where every sign-in lands (MESITA-3103). business-web-get-identity creates
// the owner's account on a first Google sign-in, then we route:
//   a deep link (`next`, or the cookie the Google path parked) → there;
//   one place they run → its profile;
//   several → the place list;
//   none → the claim search (staff: the place list, which offers search).

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
  const jar = await cookies();
  const next = safeNextPath(params.next) ?? safeNextPath(jar.get(NEXT_COOKIE)?.value);

  const identity = await getIdentity();
  // A session that is not a Google account (a phone sign-in) is refused by
  // every Business door (MESITA-3105): end it and say why.
  if (!identity.ok && identity.code === "google_only") redirect("/auth/signout?error=google_only");
  if (next) redirect(next);
  if (!identity.ok) redirect("/places");
  const owned = identity.data.places.filter((p) => p.state === "owner");
  if (owned.length === 1) redirect(`/places/${encodeURIComponent(owned[0].place_id)}/profile`);
  if (owned.length > 1 || identity.data.isSuperAdmin || identity.data.places.length > 0) redirect("/places");
  redirect("/claim");
}
