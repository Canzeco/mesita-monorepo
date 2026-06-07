import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LifeBuoy,
  PlayCircle,
  Plus,
} from "lucide-react";
import { Topbar } from "@/components/business/Topbar";
import { PageErrorState } from "@/components/business/PageErrorState";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { apiGetBusinessProfile } from "@/lib/api/business";
import { resolveVenueCategoryName } from "@/lib/venue-category";
import type { MyVenue } from "@/lib/api/venues";
import { errMsg } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ADMIN_WEB_URL_FALLBACK = "https://admin.mesita.ai";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=/unit/${id}/settings`);

  const [overviewResult, profileResult] = await Promise.allSettled([
    getUnitOverview(supabase, id, 0),
    apiGetBusinessProfile(supabase),
  ]);

  if (overviewResult.status === "rejected") {
    return (
      <PageErrorState
        title="Account"
        heading="Couldn't load your account"
        message={errMsg(overviewResult.reason, "Could not load your venues.")}
        retryHref={`/unit/${id}/settings`}
      />
    );
  }

  const overview = overviewResult.value;
  const business =
    profileResult.status === "fulfilled" ? profileResult.value : null;
  const isSuperAdmin = overview?.isSuperAdmin === true;

  const venues = overview?.venues ?? [];
  const activeVenue =
    overview?.active?.venue ??
    venues.find((v) => v.id === id) ??
    venues[0] ??
    null;
  const otherVenues = venues.filter((v) => v.id !== activeVenue?.id);

  const email = user.email ?? null;
  const accountName = isSuperAdmin
    ? "Super admin"
    : (business?.full_name ?? accountLabel(email));

  return (
    <>
      <Topbar title="Account" subtitle="Your places, profile, and more" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 pt-3 pb-10">
          {/* Current place + switcher */}
          <section className="flex flex-col gap-2">
            <SectionLabel>Current place</SectionLabel>
            {activeVenue ? (
              <div className="border-border bg-card flex items-center gap-3 rounded-2xl border px-3 py-3">
                <VenueAvatar name={activeVenue.name} />
                <div className="min-w-0 flex-1">
                  <p className="font-display truncate text-base leading-tight font-semibold tracking-tight">
                    {activeVenue.name}
                  </p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {venueSubtitle(activeVenue)}
                  </p>
                </div>
                <Check className="text-secondary h-4 w-4 shrink-0" />
              </div>
            ) : (
              <Link
                href="/add"
                className="border-border bg-background hover:border-foreground/30 flex items-center gap-3 rounded-2xl border border-dashed px-3 py-3 transition"
              >
                <span className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <Plus className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display truncate text-base leading-tight font-semibold tracking-tight">
                    No place yet
                  </p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    Add your first place
                  </p>
                </div>
              </Link>
            )}

            {!isSuperAdmin && otherVenues.length > 0 && (
              <div className="border-border bg-card mt-1 overflow-hidden rounded-2xl border">
                {otherVenues.map((v) => (
                  <Link
                    key={v.id}
                    href={`/unit/${v.id}/settings`}
                    className="hover:bg-muted/40 flex w-full items-center gap-3 px-3 py-2.5 text-left transition"
                  >
                    <VenueAvatar name={v.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm leading-tight font-semibold">
                        {v.name}
                      </p>
                      <p className="text-muted-foreground truncate text-[11px]">
                        {venueSubtitle(v)}
                      </p>
                    </div>
                    <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />
                  </Link>
                ))}
              </div>
            )}

            {!isSuperAdmin && (
              <Link
                href="/add"
                className="border-border text-secondary hover:bg-secondary/5 flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition"
              >
                <Plus className="h-4 w-4" />
                Add a place
              </Link>
            )}
          </section>

          {/* Account */}
          <section className="flex flex-col gap-2">
            <SectionLabel>Profile</SectionLabel>
            <div className="border-border bg-card flex items-center gap-3 rounded-2xl border px-3 py-3">
              <span className="bg-pink-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                {personInitial(accountName, email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{accountName}</p>
                <p className="text-muted-foreground truncate text-[11px]">
                  {email ?? ""}
                </p>
              </div>
            </div>
            {isSuperAdmin && <BackToAdminLink />}
            <SignOutButton redirectTo="/" />
          </section>

          {/* Soon */}
          <section className="flex flex-col gap-2">
            <SectionLabel>More</SectionLabel>
            <RowDisabled Icon={PlayCircle} label="Tutorials" />
            <RowDisabled Icon={LifeBuoy} label="Help & docs" />
          </section>
        </div>
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground px-1 text-[11px] font-semibold tracking-[0.12em] uppercase">
      {children}
    </p>
  );
}

function RowDisabled({
  Icon,
  label,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div
      aria-disabled
      className="border-border text-muted-foreground/60 flex cursor-not-allowed items-center gap-3 rounded-2xl border border-dashed px-3 py-3"
    >
      <span className="bg-muted/60 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 truncate text-sm font-medium">{label}</span>
      <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0 text-[9px] font-bold tracking-wider uppercase">
        Soon
      </span>
    </div>
  );
}

function BackToAdminLink() {
  const adminOrigin =
    (process.env.NEXT_PUBLIC_ADMIN_WEB_URL ?? "").trim() ||
    ADMIN_WEB_URL_FALLBACK;
  return (
    <Link
      href={`${adminOrigin.replace(/\/$/, "")}/update`}
      className="border-border bg-card hover:bg-muted flex items-center justify-center gap-2 rounded-full border py-3.5 text-sm font-semibold transition"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to admin
    </Link>
  );
}

function VenueAvatar({ name }: { name: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "·";
  return (
    <span className="bg-pink-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-sm">
      {initial}
    </span>
  );
}

function venueSubtitle(v: MyVenue): string {
  const parts = [
    v.vibe,
    resolveVenueCategoryName({
      categoryLabel: v.category_label,
      category: v.category,
    }),
  ].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(" · ");
  return v.address ?? "—";
}

function personInitial(fullName: string | null, email: string | null): string {
  const source = (fullName ?? email ?? "").trim();
  return source.slice(0, 1).toUpperCase() || "?";
}

function accountLabel(email: string | null): string {
  if (!email) return "Signed in";
  return email.split("@")[0] ?? email;
}
