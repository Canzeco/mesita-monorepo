import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Image as ImageIcon,
  Instagram,
  MapPin,
  Phone,
  Plus,
  Sparkles,
  Store,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { Topbar } from "@/components/manager/Topbar";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUnitOverview } from "@/lib/api/unit";
import { FiscalBadge } from "@/components/shared";
import { cn } from "@/lib/utils";

// /manager/home — the dashboard root. Branches by venue count:
//
//   0 venues   → CTA to /manager/create_unit
//   1 venue    → the venue's overview + jump-offs to Place / Promos /
//                Validator + this-week snapshot, completeness,
//                top guests, upcoming reservations, story queue, tips.
//   2+ venues  → unit switcher (via ?unit=<id>) + selected venue overview
//
// The thin-dashboard era is over: Home now carries enough information to
// make the manager open it daily even when nothing's broken. Heavy edits
// still live on Place / Promos / Team / Validator — Home just surfaces
// "what changed since yesterday".

export const dynamic = "force-dynamic";

export default async function ManagerHomePage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/manager/sign-in?next=/manager/home");

  const params = await searchParams;
  const requestedUnit = params.unit?.toString() ?? null;

  let overview: Awaited<ReturnType<typeof getUnitOverview>> | null = null;
  let overviewError: string | null = null;
  try {
    overview = await getUnitOverview(supabase, requestedUnit, 0);
  } catch (err) {
    overviewError =
      err instanceof Error ? err.message : "Could not load your venues.";
  }

  if (overviewError) {
    return (
      <>
        <Topbar title="Home" subtitle="Your venues, at a glance." />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
            <div className="border-destructive/40 bg-destructive/5 rounded-2xl border p-10 text-center">
              <h2 className="font-display text-destructive text-xl font-semibold tracking-tight">
                Couldn&apos;t load your home
              </h2>
              <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
                {overviewError}
              </p>
              <Link
                href="/manager/home"
                className="bg-foreground text-background mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
              >
                Try again
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const venues = overview?.venues ?? [];

  if (venues.length === 0) {
    return (
      <>
        <Topbar title="Home" subtitle="Let's get your first unit live." />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
            <div className="border-border bg-card rounded-2xl border border-dashed p-10 text-center">
              <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
                <Store className="text-muted-foreground h-5 w-5" />
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                No units yet
              </h2>
              <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
                A unit is one venue — bar, café, restaurant, club. Create your
                first one and Mesita pulls everything from Google + your website
                automatically.
              </p>
              <Link
                href="/manager/create_unit"
                className="bg-foreground text-background mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Create your first unit
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const active = overview?.active?.venue ?? venues[0];

  return (
    <>
      <Topbar title={active.name} subtitle="Home — your unit at a glance." />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
          {venues.length > 1 && (
            <UnitSwitcher
              venues={venues.map((v) => ({ id: v.id, name: v.name }))}
              activeId={active.id}
            />
          )}

          <ActiveUnitCard
            venue={{
              id: active.id,
              name: active.name,
              category: active.category,
              vibe: active.vibe,
              fiscal_type: active.fiscal_type,
              cashback_percent: active.cashback_percent,
              status: active.status,
            }}
          />

          <WeekSnapshot />

          <QuickActions activeId={active.id} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <PlaceCompletenessCard
              venue={{
                pitch: active.pitch,
                story: active.story,
                photos: active.photos,
                address: active.address,
                phone: active.phone,
                website_url: active.website_url,
                instagram_url: active.instagram_url,
                email: active.email,
              }}
              unitId={active.id}
            />
            <TopGuestsCard />
            <StoryQueueCard />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <UpcomingReservationsCard />
            <RecentActivityCard />
          </div>

          <NextActionTip
            fiscalType={active.fiscal_type}
            cashbackPercent={active.cashback_percent}
            photoCount={active.photos?.length ?? 0}
          />

          <Link
            href="/manager/create_unit"
            className="border-border bg-card text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-2 rounded-full border border-dashed px-4 py-2 text-sm font-semibold transition"
          >
            <Plus className="h-4 w-4" />
            Add another unit
          </Link>
        </div>
      </div>
    </>
  );
}

// ── Subviews ────────────────────────────────────────────────────────────

function UnitSwitcher({
  venues,
  activeId,
}: {
  venues: { id: string; name: string }[];
  activeId: string;
}) {
  return (
    <nav className="-mx-1 flex flex-wrap gap-2">
      {venues.map((v) => {
        const on = v.id === activeId;
        return (
          <Link
            key={v.id}
            href={`/manager/home?unit=${v.id}`}
            className={
              on
                ? "bg-foreground text-background rounded-full px-3 py-1.5 text-xs font-semibold"
                : "border-border bg-card text-muted-foreground hover:text-foreground rounded-full border px-3 py-1.5 text-xs font-semibold transition"
            }
          >
            {v.name}
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveUnitCard({
  venue,
}: {
  venue: {
    id: string;
    name: string;
    category: string | null;
    vibe: string | null;
    fiscal_type: "formal" | "informal";
    cashback_percent: number | null;
    status: string;
  };
}) {
  const subtitle = [venue.vibe, venue.category]
    .filter(Boolean)
    .join(" · ")
    .toLowerCase();
  return (
    <section className="border-border bg-card rounded-2xl border p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-secondary text-[10px] font-bold tracking-[0.18em] uppercase">
            Active unit
          </p>
          <h2 className="font-display mt-1 truncate text-2xl font-semibold tracking-tight">
            {venue.name}
          </h2>
          {subtitle && (
            <p className="text-muted-foreground mt-0.5 text-sm">{subtitle}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <FiscalBadge fiscalType={venue.fiscal_type} size="sm" />
            {venue.cashback_percent != null && venue.cashback_percent > 0 && (
              <span className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                <Sparkles className="h-2.5 w-2.5" />
                {venue.cashback_percent}%{" "}
                {venue.fiscal_type === "formal" ? "cashback" : "discount"}
              </span>
            )}
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
              {venue.status}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── This-week snapshot ──────────────────────────────────────────────────

function WeekSnapshot() {
  // Mock numbers — these get replaced with real EF reads once the analytics
  // pipeline lands. Tone of voice: declarative and concrete, not "your KPIs".
  const stats = [
    { label: "Visits this week", value: 142, delta: "+18%", Icon: TrendingUp },
    { label: "Coupons claimed", value: 64, delta: "+9", Icon: Ticket },
    { label: "Profile views", value: "2,310", delta: "+12%", Icon: Eye },
    {
      label: "Influenced spend",
      value: "MX$48,720",
      delta: "+MX$6.1K",
      Icon: Activity,
    },
  ];
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-semibold tracking-tight">
          This week
        </h3>
        <span className="text-muted-foreground text-[11px]">
          vs. last 7 days
        </span>
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.Icon;
          return (
            <div
              key={s.label}
              className="border-border bg-card rounded-2xl border p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
                  {s.label}
                </p>
                <Icon className="text-muted-foreground h-3.5 w-3.5" />
              </div>
              <p className="font-display mt-2 text-2xl font-bold tracking-tight tabular-nums">
                {s.value}
              </p>
              <p className="text-secondary mt-0.5 text-[11px] font-semibold">
                {s.delta}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Quick actions ───────────────────────────────────────────────────────

function QuickActions({ activeId }: { activeId: string }) {
  const tabs: {
    href: string;
    label: string;
    sub: string;
    Icon: typeof Store;
  }[] = [
    {
      href: `/manager/place?unit=${activeId}`,
      label: "Place",
      sub: "Photos, hours, channels, story",
      Icon: Store,
    },
    {
      href: `/manager/promos?unit=${activeId}`,
      label: "Promos",
      sub: "Plan, fiscal type, Welcome + tier rates",
      Icon: Ticket,
    },
    {
      href: `/validator`,
      label: "Validator",
      sub: "Open tickets, verify stories",
      Icon: CheckCircle2,
    },
  ];
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tabs.map((t) => {
        const Icon = t.Icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className="group border-border bg-card hover:border-foreground/30 flex flex-col gap-2 rounded-2xl border p-4 transition hover:shadow-sm"
          >
            <span className="bg-muted text-foreground group-hover:bg-foreground group-hover:text-background flex h-8 w-8 items-center justify-center rounded-full transition">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-base font-semibold tracking-tight">
                {t.label}
              </p>
              <p className="text-muted-foreground mt-1 text-[12px]">{t.sub}</p>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

// ── Place completeness ──────────────────────────────────────────────────

function PlaceCompletenessCard({
  venue,
  unitId,
}: {
  venue: {
    pitch: string | null;
    story: string | null;
    photos: string[];
    address: string | null;
    phone: string | null;
    website_url: string | null;
    instagram_url: string | null;
    email: string | null;
  };
  unitId: string;
}) {
  // Concrete checklist of "do this and your profile reads as ready" — each
  // tied to a real field on the venue. Lets a manager land on Home and
  // immediately see what's missing without opening Place.
  const items = [
    { ok: !!venue.pitch, label: "Add a one-line pitch", Icon: Sparkles },
    {
      ok: venue.photos.length >= 3,
      label: "Upload at least 3 photos",
      Icon: ImageIcon,
    },
    { ok: !!venue.address, label: "Confirm address", Icon: MapPin },
    { ok: !!venue.phone, label: "Add a phone number", Icon: Phone },
    { ok: !!venue.instagram_url, label: "Link Instagram", Icon: Instagram },
    {
      ok: !!venue.website_url || !!venue.email,
      label: "Website or email",
      Icon: Activity,
    },
  ];
  const done = items.filter((i) => i.ok).length;
  const pct = Math.round((done / items.length) * 100);
  return (
    <section className="border-border bg-card rounded-2xl border p-5">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold tracking-tight">
          Profile readiness
        </h3>
        <span className="text-secondary text-[11px] font-semibold tabular-nums">
          {pct}%
        </span>
      </header>
      <div className="bg-muted mt-3 h-1.5 rounded-full">
        <div
          className="bg-pink-gradient h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {items.map((i) => {
          const Icon = i.Icon;
          return (
            <li key={i.label} className="flex items-center gap-2.5 text-[12px]">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  i.ok
                    ? "bg-secondary/15 text-secondary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {i.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
              </span>
              <span
                className={cn(
                  i.ok
                    ? "text-muted-foreground line-through"
                    : "text-foreground",
                )}
              >
                {i.label}
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        href={`/manager/place?unit=${unitId}`}
        className="text-foreground hover:text-primary mt-4 inline-flex items-center gap-1 text-[12px] font-semibold"
      >
        Open Place <ArrowRight className="h-3 w-3" />
      </Link>
    </section>
  );
}

// ── Top guests this week ────────────────────────────────────────────────

function TopGuestsCard() {
  const guests = [
    { handle: "@valenrose", tier: "gold" as const, visits: 4 },
    { handle: "@camivb", tier: "gold" as const, visits: 3 },
    { handle: "@sofip", tier: "silver" as const, visits: 3 },
    { handle: "@lucasm", tier: "silver" as const, visits: 2 },
    { handle: "@anita", tier: "bronze" as const, visits: 2 },
  ];
  return (
    <section className="border-border bg-card rounded-2xl border p-5">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold tracking-tight">
          Top guests this week
        </h3>
        <span className="text-muted-foreground text-[11px]">By visits</span>
      </header>
      <ul className="divide-border mt-3 flex flex-col divide-y">
        {guests.map((g) => (
          <li
            key={g.handle}
            className="flex items-center gap-2 py-2 text-[12px]"
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase",
                g.tier === "bronze" && "bg-tier-bronze text-white",
                g.tier === "silver" && "bg-tier-silver text-foreground",
                g.tier === "gold" && "bg-tier-gold text-black",
              )}
            >
              {g.tier[0]}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">
              {g.handle}
            </span>
            <span className="text-muted-foreground font-semibold tabular-nums">
              {g.visits}× visits
            </span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-3 text-[11px]">
        Handles auto-hidden until each guest finishes their first visit at your
        venue.
      </p>
    </section>
  );
}

// ── Story verification queue ────────────────────────────────────────────

function StoryQueueCard() {
  const pending = 3;
  const verifiedToday = 12;
  return (
    <section className="border-border bg-card rounded-2xl border p-5">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold tracking-tight">
          Story queue
        </h3>
        <span className="text-muted-foreground text-[11px]">AI + waiter</span>
      </header>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
            Pending review
          </p>
          <p className="font-display mt-1 text-2xl font-bold tabular-nums">
            {pending}
          </p>
        </div>
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
            Verified today
          </p>
          <p className="font-display mt-1 text-2xl font-bold tabular-nums">
            {verifiedToday}
          </p>
        </div>
      </div>
      <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
        AI verifies @mentions and location tags automatically. Ambiguous stories
        fall through to a waiter on WhatsApp.
      </p>
      <Link
        href="/validator"
        className="text-foreground hover:text-primary mt-3 inline-flex items-center gap-1 text-[12px] font-semibold"
      >
        Open Validator <ArrowRight className="h-3 w-3" />
      </Link>
    </section>
  );
}

// ── AI reservations sent (attribution log) ──────────────────────────────

function UpcomingReservationsCard() {
  // Reservations don't live inside Mesita — guests deploy a Mesita AI agent
  // that contacts the venue through its existing channel (IG DM, WhatsApp,
  // voice, web form, OpenTable). The booking lands in whatever system the
  // venue already uses; Mesita just sends it. This card is therefore an
  // attribution log: "here's how many high-intent reservations Mesita
  // pushed to your existing booking system this week."
  const reservations: {
    handle: string;
    tier: "bronze" | "silver" | "gold";
    party: number;
    when: string;
    channel: "voice" | "whatsapp" | "instagram" | "opentable";
  }[] = [
    {
      handle: "@valenrose",
      tier: "gold",
      party: 4,
      when: "Tonight · 9:30 PM",
      channel: "instagram",
    },
    {
      handle: "@matgg",
      tier: "gold",
      party: 2,
      when: "Tonight · 10:00 PM",
      channel: "voice",
    },
    {
      handle: "@noctura",
      tier: "silver",
      party: 6,
      when: "Fri · 8:00 PM",
      channel: "whatsapp",
    },
    {
      handle: "@luispb",
      tier: "silver",
      party: 2,
      when: "Sat · 9:30 PM",
      channel: "opentable",
    },
  ];
  const channelLabel: Record<(typeof reservations)[number]["channel"], string> =
    {
      voice: "Voice call",
      whatsapp: "WhatsApp",
      instagram: "Instagram DM",
      opentable: "OpenTable",
    };
  return (
    <section className="border-border bg-card rounded-2xl border p-5">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold tracking-tight">
          AI reservations sent
        </h3>
        <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
          <Calendar className="h-3 w-3" />
          This week
        </span>
      </header>
      <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
        Mesita&apos;s AI agent contacted you through your usual channel and
        confirmed these. They live in your own booking system — Mesita
        doesn&apos;t manage the queue.
      </p>
      <ul className="divide-border mt-3 flex flex-col divide-y">
        {reservations.map((r, i) => (
          <li key={i} className="flex items-center gap-3 py-2.5">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase",
                r.tier === "bronze" && "bg-tier-bronze text-white",
                r.tier === "silver" && "bg-tier-silver text-foreground",
                r.tier === "gold" && "bg-tier-gold text-black",
              )}
            >
              {r.tier[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.handle}</p>
              <p className="text-muted-foreground text-[11px]">
                Party of {r.party} · sent via {channelLabel[r.channel]}
              </p>
            </div>
            <p className="text-foreground shrink-0 text-[11px] font-semibold">
              {r.when}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Recent activity feed ────────────────────────────────────────────────

function RecentActivityCard() {
  const events = [
    {
      Icon: Ticket,
      title: "Coupon claimed",
      detail: "@sofip · 10% cashback",
      when: "12 min ago",
    },
    {
      Icon: CheckCircle2,
      title: "Story verified",
      detail: "@valenrose · 4.2K views",
      when: "1h ago",
    },
    {
      Icon: Calendar,
      title: "Reservation sent via Instagram",
      detail: "Mesita AI · party of 4 · tonight 9:30 PM",
      when: "3h ago",
    },
    {
      Icon: Users,
      title: "First-time visitor",
      detail: "Welcome coupon redeemed",
      when: "Yesterday",
    },
  ];
  return (
    <section className="border-border bg-card rounded-2xl border p-5">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-semibold tracking-tight">
          Recent activity
        </h3>
        <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
          <Clock className="h-3 w-3" />
          Last 24h
        </span>
      </header>
      <ul className="divide-border mt-3 flex flex-col divide-y">
        {events.map((e, i) => {
          const Icon = e.Icon;
          return (
            <li key={i} className="flex items-start gap-3 py-2.5">
              <span className="bg-muted text-foreground mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{e.title}</p>
                <p className="text-muted-foreground text-[11px]">{e.detail}</p>
              </div>
              <p className="text-muted-foreground shrink-0 text-[11px]">
                {e.when}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Next-action tip ─────────────────────────────────────────────────────

function NextActionTip({
  fiscalType,
  cashbackPercent,
  photoCount,
}: {
  fiscalType: "formal" | "informal";
  cashbackPercent: number | null;
  photoCount: number;
}) {
  // Picks the single most-impactful next move based on the venue's current
  // state. One tip at a time keeps the surface focused — manager sees it,
  // acts on it, comes back tomorrow.
  const tip = (() => {
    if (photoCount < 3) {
      return {
        title: "Add more photos to win the swipe",
        body: "Cards with 3+ photos convert 2× better. Aim for a hero shot, a vibe shot, and the bill / menu.",
        href: "/manager/place",
        cta: "Open Place",
      };
    }
    if (cashbackPercent == null || cashbackPercent === 0) {
      return {
        title: `Set your ${fiscalType === "formal" ? "cashback" : "discount"} rate`,
        body: "Promos lets you set a Welcome rate for first-time guests and per-tier rates for returning ones.",
        href: "/manager/promos",
        cta: "Open Promos",
      };
    }
    return {
      title: "Try a Welcome coupon at 20%",
      body: "Welcome converts the cold pool of guests near you who've never visited. 20% is the sweet spot on first visit.",
      href: "/manager/promos",
      cta: "Open Promos",
    };
  })();
  return (
    <section className="bg-pink-gradient shadow-glow overflow-hidden rounded-2xl p-5 text-white">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.2em] text-white/80 uppercase">
            Next action
          </p>
          <h3 className="font-display mt-1 text-lg font-semibold tracking-tight">
            {tip.title}
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-white/90">
            {tip.body}
          </p>
          <Link
            href={tip.href}
            className="text-foreground mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12px] font-semibold transition hover:opacity-90"
          >
            {tip.cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {/* Subtle warn icon when readiness is low — keeps the eye on the tip. */}
        {(photoCount < 3 ||
          cashbackPercent == null ||
          cashbackPercent === 0) && (
          <AlertTriangle className="h-4 w-4 shrink-0 text-white/70" />
        )}
      </div>
    </section>
  );
}
