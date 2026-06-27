import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { AppHeader, type HeaderPlace } from "@/components/auth/AppHeader";
import { MobileFrame } from "@/components/business/MobileFrame";
import { CreateUnitForm } from "./CreateUnitForm";

// /add lets a business operator claim a place. Distinct from /onboard,
// which captures the business operator's own name once. /add is recurring
// (multi-unit operators add N places over time) and also the de-facto home
// for first-time users who haven't added anything yet.
//
// Renders with AppHeader at the top instead of the old "Back to home"
// link, so the operator can sign out / jump back to an existing place
// at any point without dead-ending here.

export const dynamic = "force-dynamic";

export default async function CreateUnitPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/add");

  // Best-effort places fetch so AppHeader can render the
  // jump-to-place menu. Failure here shouldn't break /add itself —
  // we just render an empty places list in that case.
  let places: HeaderPlace[] = [];
  try {
    const overview = await getUnitOverview(supabase, null, 0);
    places = (overview?.places ?? []).map((v) => ({ id: v.id, name: v.name }));
  } catch (err) {
    console.error("[add] business-get-overview:", err);
  }

  return (
    <MobileFrame>
      <AppHeader email={user.email ?? null} places={places} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[640px] flex-col px-5 py-8">
          <header className="mb-6">
            <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em]">
              Add a place
            </h1>
            <p className="text-muted-foreground mt-2 text-[14.5px] leading-[1.55]">
              Type the place&apos;s name — we pull the profile straight from
              Google and show its current Mesita status inline.
            </p>
          </header>
          <CreateUnitForm signedInEmail={user.email ?? ""} />
        </div>
      </div>
    </MobileFrame>
  );
}
