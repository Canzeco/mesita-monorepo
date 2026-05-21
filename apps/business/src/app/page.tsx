import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Camera,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { apiGetManagerProfile } from "@/lib/api/manager";
import { AppHeader } from "@/components/auth/AppHeader";

// Root behaviour:
//
//   no session         → render the marketing landing (this page)
//   not onboarded      → /onboard
//   no venues          → render the venue-less hub (empty state +
//                        "Add your first venue" CTA → /add). Used to
//                        redirect to /add, which created a "Back to
//                        home" loop on /add itself.
//   venues exist       → render the multi-venue hub (venue cards +
//                        "Add another" CTA). Used to redirect into
//                        /unit/<first>/home, which made the brand link
//                        feel like a trap — clicking "home" force-
//                        shunted you into one specific venue's
//                        dashboard. Post-signin still lands users
//                        directly on their venue via /auth/post-signin;
//                        this page only renders when someone explicitly
//                        navigates to `/`.

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    let manager = null;
    try {
      manager = await apiGetManagerProfile(supabase);
    } catch (err) {
      console.error("[root] manager-profile:", err);
    }
    if (!manager?.full_name) redirect("/onboard");

    let overview = null;
    try {
      overview = await getUnitOverview(supabase, null, 0);
    } catch (err) {
      console.error("[root] manager-get-overview:", err);
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

  return (
    <div className="bg-hero min-h-dvh">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 md:px-10">
        <Brandmark />
        <div className="flex items-center gap-4 md:gap-5">
          <Link
            href="/sign-in"
            className="text-foreground text-sm font-semibold transition hover:opacity-80"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="bg-pink-gradient shadow-glow inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-white transition hover:brightness-105"
          >
            Become a partner
          </Link>
        </div>
      </nav>

      <header className="mx-auto max-w-3xl px-6 pt-8 pb-6 text-center md:pt-12">
        <p className="text-secondary text-[11px] font-bold tracking-[0.18em] uppercase">
          Mesita for venues
        </p>
        <h1 className="font-display mx-auto mt-4 max-w-[14ch] text-[42px] leading-[1.04] font-semibold tracking-[-0.03em] md:text-[54px]">
          Turn who walks in into a{" "}
          <em className="text-primary [font-style:italic]">
            lever you can pull.
          </em>
        </h1>
        <p className="text-muted-foreground mx-auto mt-5 max-w-[60ch] text-base leading-[1.55] md:text-[17px]">
          Mesita already lists every venue in your city — auto-built from
          the open internet. Become a Verified Partner to compete for the
          guests who actually move the needle, with cashback or instant
          discounts, priority placement, and one dashboard for all of it.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/sign-up"
            className="bg-pink-gradient shadow-glow inline-flex h-[52px] items-center gap-2 rounded-full px-7 text-[15px] font-semibold text-white transition hover:brightness-105"
          >
            Become a partner
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/sign-in"
            className="bg-foreground text-background inline-flex h-[52px] items-center gap-2 rounded-full px-7 text-[15px] font-semibold transition hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
        <p className="text-muted-foreground mt-5 flex flex-wrap justify-center gap-2 text-[12.5px]">
          <span>
            <b className="text-foreground font-semibold">~10 min</b> setup
          </span>
          <span className="opacity-40">·</span>
          <span>
            <b className="text-foreground font-semibold">$0</b> until it
            pays off
          </span>
          <span className="opacity-40">·</span>
          <span>No POS, no hardware, no training</span>
        </p>
      </header>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 py-8 sm:grid-cols-2 md:px-10 lg:grid-cols-4">
        <FeatureCard
          Icon={Search}
          title="Get discovered"
          blurb="Priority placement over the ~100× larger pool of web-listed venues across swipe, map, catalog, and AI search."
        />
        <FeatureCard
          Icon={Star}
          title="Win magnetic guests"
          blurb="Set separate rates per tier — Bronze, Silver, Gold, Diamond — to attract the guests who fill your room."
        />
        <FeatureCard
          Icon={Camera}
          title="Automated IG stories"
          blurb="Our AI verifies a guest's tagged story and releases the reward — authentic reach, no chasing screenshots."
        />
        <FeatureCard
          Icon={BarChart3}
          title="Marketing intelligence"
          blurb="Influenced spend, conversion funnel, ROAS, and a tier-source breakdown in one dashboard with an AI copilot."
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 pt-4 pb-10 md:px-10">
        <div className="text-center">
          <h2 className="font-display text-[30px] font-semibold tracking-[-0.02em]">
            Simple, two-axis pricing
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Three plans while we make adoption easy. Your fiscal type
            decides the mechanic.
          </p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PriceCard
            tag="Free"
            amount="$0"
            mechanicLabel="None"
            blurb="minimum visibility"
          />
          <PriceCard
            tag="Formal Pro"
            amount="$200"
            mechanicLabel="Cashback"
            blurb="priority placement"
            featured
          />
          <PriceCard
            tag="Informal Pro"
            amount="$400"
            mechanicLabel="Instant discount"
            blurb="priority placement"
          />
        </div>
      </section>

      <footer className="border-border text-muted-foreground border-t px-6 py-7 text-center text-xs">
        Made in Monterrey · © Mesita
      </footer>
    </div>
  );
}

function Brandmark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 no-underline">
      <span className="bg-peacock shadow-glow flex h-9 w-9 items-center justify-center rounded-full text-base">
        🦚
      </span>
      <span className="font-display text-[21px] font-semibold tracking-[-0.02em]">
        mesita.
      </span>
    </Link>
  );
}

function FeatureCard({
  Icon,
  title,
  blurb,
}: {
  Icon: typeof Search;
  title: string;
  blurb: string;
}) {
  return (
    <div className="bg-card-soft border-border rounded-[20px] border p-6">
      <div className="bg-primary/10 text-primary mb-3.5 flex h-10 w-10 items-center justify-center rounded-[13px]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em]">
        {title}
      </h3>
      <p className="text-muted-foreground mt-1.5 text-[13px] leading-[1.5]">
        {blurb}
      </p>
    </div>
  );
}

function PriceCard({
  tag,
  amount,
  mechanicLabel,
  blurb,
  featured,
}: {
  tag: string;
  amount: string;
  mechanicLabel: string;
  blurb: string;
  featured?: boolean;
}) {
  return (
    <div
      className={
        "bg-card relative rounded-[22px] border p-6 " +
        (featured ? "border-primary/50 shadow-glow" : "border-border")
      }
    >
      {featured && (
        <span className="bg-pink-gradient shadow-glow absolute -top-3 right-5 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-[0.08em] text-white uppercase">
          Most picked
        </span>
      )}
      <p className="text-muted-foreground text-[11px] font-bold tracking-[0.12em] uppercase">
        {tag}
      </p>
      <p className="font-display mt-2.5 mb-0.5 text-[34px] font-semibold">
        {amount}{" "}
        <small className="text-muted-foreground text-sm font-medium">
          MXN / mo
        </small>
      </p>
      <p className="text-muted-foreground mt-1.5 text-[13px]">
        Mechanic: <b className="text-foreground">{mechanicLabel}</b> ·{" "}
        {blurb}
      </p>
    </div>
  );
}

// Authenticated + no venues. The empty home — used to be a redirect
// to /add (loop) — now an explicit hub with AppHeader (sign-out lives
// there) and a single CTA to /add. Same shell as the dashboard
// surfaces in spirit; no sidebar because there's nothing to navigate
// yet.
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
              Mesita lists every venue on the open internet. Claim
              the one you operate (or create a brand new listing) and
              your dashboard shows up here.
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

// Authenticated + at least one venue. Used to be a hard redirect to
// /unit/<first>/home which made the brand link from /add (and any
// other "home" gesture) feel like a trap. Now it's a real navigable
// hub: AppHeader, venue cards (each links to its dashboard), and an
// "Add another" CTA. Post-signin still lands users directly on a
// venue via /auth/post-signin so the happy-path login is unchanged;
// this hub only shows when someone explicitly hits `/`.
function VenueHub({
  email,
  venues,
}: {
  email: string | null;
  venues: Array<{ id: string; name: string; address: string | null }>;
}) {
  return (
    <div className="bg-background min-h-dvh">
      <AppHeader email={email} venues={venues.map(({ id, name }) => ({ id, name }))} />
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
