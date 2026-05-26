import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  LayoutGrid,
  MapPin,
  Package,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
//   no venues      → render VenuelessHub (Add your first place CTA)
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

// Entity types operators can list on Mesita. Place is live today (claims
// an existing venue or creates a new one via /add); the other five are
// scaffolded as "Soon" tiles so the surface signals where the roadmap
// is headed without enabling backends that don't exist yet.
type EntityOption = {
  label: string;
  Icon: LucideIcon;
  href: string | null; // null = disabled "Soon" tile
};

const ENTITY_OPTIONS: EntityOption[] = [
  { label: "Place", Icon: MapPin, href: "/add" },
  { label: "Event", Icon: CalendarDays, href: null },
  { label: "Community", Icon: Users, href: null },
  { label: "Products", Icon: Package, href: null },
  { label: "Services", Icon: Wrench, href: null },
  { label: "Micro-app", Icon: LayoutGrid, href: null },
];

// Authenticated + no venues. Empty home — Place is the live CTA, the
// other entity types render as disabled "Soon" tiles to preview what's
// coming. Same AppHeader shell as the multi-venue variant so the
// operator can sign out without a sidebar.
function VenuelessHub({ email }: { email: string | null }) {
  return (
    <div className="bg-background min-h-dvh">
      <AppHeader email={email} venues={[]} />
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="border-border bg-card-soft flex flex-col items-center gap-6 rounded-[22px] border p-10 text-center">
          <span className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em]">
              Add your first place
            </h1>
            <p className="text-muted-foreground mt-2 max-w-[44ch] text-sm leading-[1.55]">
              Mesita lists every place on the open internet. Claim the one you
              operate (or create a brand new listing) and your dashboard shows
              up here. Events, communities, products, services and micro-apps
              are next.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
            {ENTITY_OPTIONS.map((opt) => (
              <AddEntityTile key={opt.label} option={opt} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddEntityTile({ option }: { option: EntityOption }) {
  const { label, Icon, href } = option;
  if (href) {
    return (
      <Link
        href={href}
        className="bg-pink-gradient shadow-glow flex h-full flex-col items-center justify-center gap-1.5 rounded-[14px] px-3 py-4 text-sm font-semibold text-white transition hover:brightness-105"
      >
        <Icon className="h-4 w-4" />
        {label}
        <ArrowRight className="h-3.5 w-3.5 opacity-90" />
      </Link>
    );
  }
  return (
    <div
      aria-disabled
      className="border-border text-muted-foreground/70 bg-card relative flex h-full flex-col items-center justify-center gap-1.5 rounded-[14px] border px-3 py-4 text-sm font-medium"
    >
      <Icon className="h-4 w-4" />
      {label}
      <span className="bg-secondary/10 text-secondary absolute top-1.5 right-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase">
        Soon
      </span>
    </div>
  );
}

// Authenticated + at least one venue. The "Your places" hub — venue
// cards link into their unit dashboard, plus the same 6-tile entity
// picker under an "Add another" eyebrow. Post-signin lands users here.
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
          Your places
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Pick a place to open its dashboard, or add another.
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
        <div className="mt-8">
          <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
            Add another
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ENTITY_OPTIONS.map((opt) => (
              <AddEntityTile key={opt.label} option={opt} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
