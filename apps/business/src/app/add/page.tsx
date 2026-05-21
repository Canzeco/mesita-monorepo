import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { AppHeader, type HeaderVenue } from "@/components/auth/AppHeader";
import { CreateUnitForm } from "./CreateUnitForm";

// /add lets a manager claim a venue. Distinct from /onboard, which
// captures the manager's own name once. /add is recurring (multi-unit
// operators add N venues over time) and also the de-facto home for
// first-time users who haven't added anything yet.
//
// Renders with AppHeader at the top instead of the old "Back to home"
// link, so the operator can sign out / jump back to an existing venue
// at any point without dead-ending here.

export const dynamic = "force-dynamic";

export default async function CreateUnitPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/add");

  // Best-effort venues fetch so AppHeader can render the
  // jump-to-venue menu. Failure here shouldn't break /add itself —
  // we just render an empty venues list in that case.
  let venues: HeaderVenue[] = [];
  try {
    const overview = await getUnitOverview(supabase, null, 0);
    venues = (overview?.venues ?? []).map((v) => ({ id: v.id, name: v.name }));
  } catch (err) {
    console.error("[add] manager-get-overview:", err);
  }

  return (
    <div className="bg-background min-h-dvh w-full">
      <AppHeader email={user.email ?? null} venues={venues} />
      <div className="mx-auto flex max-w-[640px] flex-col px-6 py-10">
        <header className="mb-6">
          <h1 className="font-display text-[30px] font-semibold tracking-[-0.02em]">
            Add a venue
          </h1>
          <p className="text-muted-foreground mt-2 max-w-[54ch] text-[14.5px] leading-[1.55]">
            Type the venue&apos;s name — we pull the profile straight from
            Google and show its current Mesita status inline.
          </p>
        </header>
        <CreateUnitForm signedInEmail={user.email ?? ""} />
      </div>
    </div>
  );
}
