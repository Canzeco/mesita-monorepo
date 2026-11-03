import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getIdentity } from "@/lib/business-api";
import { NEXT_COOKIE, safeNextPath } from "@/lib/safe-next";
import { PLACES, placeTabHref } from "@/lib/routes";

// Where every sign-in lands (MESITA-3103). business-web-get-identity creates
// the owner's account on a first Google sign-in, then we route:
//   a deep link (`next`, or the cookie the Google path parked) → there;
//   one place they run → its profile;
//   several, none, or staff → Places, whose search claims or opens a place.

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
  if (!identity.ok) redirect(PLACES);
  const owned = identity.data.places.filter((p) => p.state === "owner");
  if (owned.length === 1) redirect(placeTabHref(owned[0].place_id, "profile"));
  // Everyone else lands on Places: its search is where you claim (MESITA-3141).
  redirect(PLACES);
}
