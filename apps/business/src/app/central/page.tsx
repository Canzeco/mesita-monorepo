import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, MapPin, Plus, Sparkles } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import {
  apiGetBusinessProfile,
  type BusinessProfile,
} from "@/lib/api/business";
import { AppHeader } from "@/components/auth/AppHeader";
import { errMsg } from "@/lib/utils";

// /central — the business operator's venue hub. Lives one level below
// `/` (which is the auth surface). Strong routing contract:
//
//   no session     → /            (sign in first)
//   not onboarded  → /onboard     (capture name)
//   no venues      → render VenuelessHub (Add your first venue CTA)
//   has venues     → render VenueHub    (cards + Add another CTA)
//
// Always renders behind AppHeader so the operator can sign out / jump
// to a different venue mid-flow.

export const dynamic = "force-dynamic";

export default async function CentralPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?next=/central");

  let profile: BusinessProfile | null = null;
  try {
    profile = await apiGetBusinessProfile(supabase);
  } catch (err) {
    console.error("[central] business-get-profile:", errMsg(err, ""));
  }
  if (!profile?.full_name) redirect("/onboard");

  let overview: Awaited<ReturnType<typeof getUnitOverview>> | null = null;
  try {
    overview = await getUnitOverview(supabase, null, 0);
  } catch (err) {
    console.error("[central] business-get-overview:", errMsg(err, ""));
  }
  const venues = (overview?.venues ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    address: v.address ?? null,
  }));

  if (venues.length === 0) {
    return <VenuelessHub email={user.email ?? null} />;
  }
  return <VenueHub email={user.email ?? null} venues={venues} />;
}

// Authenticated + no venues. Empty home — single CTA to /add. Same
// AppHeader shell as the multi-venue variant so the operator can sign
// out without a sidebar.
function VenuelessHub({ email }: { email: string | null }) {
  return (
    <div className="bg-background min-h-dvh">
      <AppHeader email={email} venues={[]} />
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="border-border bg-card-soft flex flex-col items-center gap-5 rounded-[22px] border p-10 text-center">
          <span className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em]">
              Add your first venue
            </h1>
            <p className="text-muted-foreground mt-2 max-w-[44ch] text-sm leading-[1.55]">
              Mesita lists every venue on the open internet. Claim the one you
              operate (or create a brand new listing) and your dashboard shows
              up here.
            </p>
          </div>
          <Link
            href="/add"
            className="bg-pink-gradient shadow-glow inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white transition hover:brightness-105"
          >
            <MapPin className="h-4 w-4" />
            Add a venue
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// Authenticated + at least one venue. The "Your venues" hub from the
// screenshot — venue cards link into their unit dashboard, plus a
// dashed "Add another" CTA. Post-signin lands users here.
function VenueHub({
  email,
  venues,
}: {
  email: string | null;
  venues: Array<{ id: string; name: string; address: string | null }>;
}) {
  return (
    <div className="bg-background min-h-dvh">
      <AppHeader
        email={email}
        venues={venues.map(({ id, name }) => ({ id, name }))}
      />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em]">
          Your venues
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Pick a venue to open its dashboard, or add another.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {venues.map((v) => (
            <Link
              key={v.id}
              href={`/unit/${v.id}/home`}
              className="border-border bg-card hover:border-foreground/30 group flex flex-col gap-2.5 rounded-[18px] border p-5 transition"
            >
              <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-full">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <p className="font-display text-base font-semibold tracking-[-0.01em]">
                  {v.name}
                </p>
                {v.address && (
                  <p className="text-muted-foreground mt-0.5 truncate text-[12px]">
                    {v.address}
                  </p>
                )}
              </div>
              <span className="text-muted-foreground mt-2 inline-flex items-center gap-1 text-[12px] font-medium">
                Open dashboard
                <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
        <Link
          href="/add"
          className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground mt-3 flex items-center justify-center gap-2 rounded-[18px] border border-dashed py-4 text-sm font-medium transition"
        >
          <Plus className="h-4 w-4" />
          Add another venue
        </Link>
      </div>
    </div>
  );
}
