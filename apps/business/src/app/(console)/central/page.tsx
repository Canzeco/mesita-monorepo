import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
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
import { placePath } from "@/lib/business-route-contract";
import { errMsg } from "@/lib/utils";

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
  const places = (overview?.places ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    address: v.address ?? null,
  }));

  if (places.length === 0) {
    return <PlacelessHub />;
  }
  return <PlaceHub places={places} />;
}

type EntityOption = {
  label: string;
  Icon: LucideIcon;
  href: string | null;
};

const ENTITY_OPTIONS: EntityOption[] = [
  { label: "Place", Icon: MapPin, href: "/add" },
  { label: "Event", Icon: CalendarDays, href: null },
  { label: "Community", Icon: Users, href: null },
  { label: "Products", Icon: Package, href: null },
  { label: "Services", Icon: Wrench, href: null },
];

function PlacelessHub() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="border-border bg-card-soft flex flex-col items-center gap-6 rounded-[22px] border p-7 text-center">
          <span className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em]">
              Add your first place
            </h1>
            <p className="text-muted-foreground mt-2 text-sm leading-[1.55]">
              Mesita lists every place on the open internet. Claim the one you
              operate (or create a brand new listing) and your dashboard shows
              up here. Events, communities, products and services are next.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2">
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
        className="bg-pink-gradient shadow-glow relative flex h-24 flex-col items-center justify-center rounded-[14px] px-3 py-4 text-sm font-semibold text-white transition hover:brightness-105"
      >
        <Icon className="h-4 w-4" />
        {label}
        <ArrowRight className="absolute bottom-2.5 h-3.5 w-3.5 opacity-90" />
      </Link>
    );
  }
  return (
    <div
      aria-disabled
      className="border-border text-muted-foreground/70 bg-card relative flex h-24 flex-col items-center justify-center rounded-[14px] border px-3 py-4 text-sm font-medium"
    >
      <Icon className="h-4 w-4" />
      {label}
      <span className="bg-secondary/10 text-secondary absolute top-1.5 right-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase">
        Soon
      </span>
    </div>
  );
}

function PlaceHub({
  places,
}: {
  places: Array<{ id: string; name: string; address: string | null }>;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em]">
          Your places
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Pick a place to open its dashboard, or add another.
        </p>
        <div className="mt-6 grid gap-3">
          {places.map((v) => (
            <Link
              key={v.id}
              href={placePath(v.id)}
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
          <div className="mt-3 grid grid-cols-2 gap-2">
            {ENTITY_OPTIONS.map((opt) => (
              <AddEntityTile key={opt.label} option={opt} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
