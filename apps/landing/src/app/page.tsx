import Image from "next/image";
import Link from "next/link";
import {
  Compass,
  CalendarCheck,
  Wallet,
  Sparkles,
  TrendingUp,
  Instagram,
  BarChart3,
  Smartphone,
  Apple,
  Globe,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Landing page — single-source-of-truth marketing surface.
//
// Composition is intentionally flat: seven sections in order, nothing
// nested. Each section is its own function so the file reads top-to-
// bottom and the section order matches the page order.
//
//   1. <Nav />             Top menu bar
//   2. <Hero />            Headline + download CTAs + product shot
//   3. <ForGuests />       Solutions for guests (3 cards)
//   4. <ForVenues />       Solutions for venues (5 cards)
//   5. <Pricing />         Venue pricing (3 plans + fiscal-type explainer)
//   6. <FAQ />             Six essentials, expandable
//   7. <Footer />          © Mesita 2026 etc.

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      <Nav />
      <Hero />
      <ForGuests />
      <ForVenues />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  );
}

// ─── 1. Top menu bar ─────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="border-border bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 w-full border-b backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5">
        <Link
          href="/"
          className="font-display flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span aria-hidden className="text-xl">
            🌲
          </span>
          mesita
          <span className="text-primary">.</span>
        </Link>
        <nav className="text-muted-foreground hidden items-center gap-7 text-sm md:flex">
          <a href="#guests" className="hover:text-foreground transition">
            Guests
          </a>
          <a href="#venues" className="hover:text-foreground transition">
            Venues
          </a>
          <a href="#pricing" className="hover:text-foreground transition">
            Pricing
          </a>
          <a href="#faq" className="hover:text-foreground transition">
            FAQ
          </a>
        </nav>
        <Button asChild size="sm" className="rounded-full">
          <Link href="/manager/sign-up">
            List your venue
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </header>
  );
}

// ─── 2. Hero ─────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="bg-hero relative overflow-hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 pt-16 pb-12 text-center md:pt-24 md:pb-20">
        <Badge
          variant="outline"
          className="bg-background/70 text-muted-foreground rounded-full px-3 py-1 text-xs font-medium backdrop-blur"
        >
          Smart hospitality · Made in Monterrey
        </Badge>

        <h1 className="font-display max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight md:text-6xl">
          The smartest cashback wallet for going out.
        </h1>

        <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed md:text-xl">
          Every bar, café, restaurant, and club in your city — recommended,
          AI-booked, and rewarded in one app. Some guests are part of the
          product; everyone benefits.
        </p>

        {/* Download CTAs: three rails (App Store, Google Play, Web). iOS +
            Android are pre-launch — the Web Guest experience is live now
            so the click has somewhere real to land. */}
        <div className="mt-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <DownloadButton
            disabled
            primary={false}
            label="Coming on"
            store="App Store"
            Icon={Apple}
          />
          <DownloadButton
            disabled
            primary={false}
            label="Coming on"
            store="Google Play"
            Icon={Smartphone}
          />
          <Button
            asChild
            size="lg"
            className="bg-pink-gradient shadow-glow rounded-full px-5 text-white hover:opacity-90"
          >
            <Link href="/guest">
              <Globe />
              Open the web app
            </Link>
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">
          Free to use · No download required for the web · Cashback on every
          visit
        </p>

        <figure className="border-border shadow-elev mt-8 w-full overflow-hidden rounded-3xl border md:mt-12">
          <Image
            src="/landing-hero.jpg"
            alt="Tacos and a Mesita-branded drink on a rooftop with Monterrey's skyline behind"
            width={1540}
            height={1021}
            priority
            sizes="(max-width: 1024px) 100vw, 1100px"
            className="h-auto w-full"
          />
        </figure>
      </div>
    </section>
  );
}

function DownloadButton({
  label,
  store,
  Icon,
  primary,
  disabled,
}: {
  label: string;
  store: string;
  Icon: typeof Apple;
  primary: boolean;
  disabled?: boolean;
}) {
  const className = primary
    ? "bg-foreground text-background hover:opacity-90"
    : "border border-border bg-background text-foreground hover:bg-muted/50";
  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-left transition disabled:cursor-default disabled:opacity-70 ${className}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className="text-[9px] tracking-[0.18em] uppercase opacity-70">
          {label}
        </span>
        <span className="text-[13px] font-semibold">{store}</span>
      </span>
    </button>
  );
}

// ─── 3. Solutions for Guests ─────────────────────────────────────────────

function ForGuests() {
  const items: {
    title: string;
    body: string;
    Icon: typeof Compass;
  }[] = [
    {
      title: "Experience intelligence",
      body: "The most complete catalog in your city — ratings, prices, vibes, photos, and where Bronze, Silver, Gold, and Diamond guests are going right now. Swipe, map, catalog, or just ask the AI.",
      Icon: Compass,
    },
    {
      title: "AI-booked reservations",
      body: "One tap and Mesita's AI agent contacts the venue for you — voice, IG DM, WhatsApp, web form, or email — and locks in the table. Works at every venue in the city, even ones that never signed with us.",
      Icon: CalendarCheck,
    },
    {
      title: "Cashback that compounds",
      body: "Pay through Mesita and earn cashback to your wallet at Formal partners; get an instant discount at Informal ones. Your balance auto-applies to your next bill at any partner, Formal or Informal.",
      Icon: Wallet,
    },
  ];
  return (
    <section id="guests" className="border-border border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <header className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
              For guests
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              Three things only Mesita gives you.
            </h2>
          </div>
          <p className="text-muted-foreground max-w-sm text-sm">
            Mesita Bronze is free forever. Silver, Gold, and Diamond grant
            higher cashback at every partner — earned with Instagram followers
            or a monthly subscription.
          </p>
        </header>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {items.map((it) => {
            const Icon = it.Icon;
            return (
              <article
                key={it.title}
                className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-6"
              >
                <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  {it.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {it.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── 4. Solutions for Venues ─────────────────────────────────────────────

function ForVenues() {
  const items: {
    title: string;
    body: string;
    Icon: typeof TrendingUp;
  }[] = [
    {
      title: "Get discovered & win customers",
      body: "Priority placement across swipe, map, catalog, and AI planner — above the ~100× larger pool of auto-listed venues. A one-time Welcome coupon converts first-time visitors into regulars.",
      Icon: TrendingUp,
    },
    {
      title: "Win the magnetic & rich customers",
      body: "Set cashback (or discount) rates per tier — Bronze, Silver, Gold, Diamond. Reward the guests who actually fill the room and post it to thousands; pay base rates to walk-ins.",
      Icon: Sparkles,
    },
    {
      title: "Automated Instagram stories",
      body: "Mesita's AI bot verifies the @mention or location tag on every story. Ambiguous ones fall through to a waiter on WhatsApp. Real organic reach, no chasing screenshots.",
      Icon: Instagram,
    },
    {
      title: "Easier reservations",
      body: "Bookings come in through your existing channel — IG DM, WhatsApp, voice, OpenTable, or email. No new tools, no new tablet at the host stand. You see tier and party size before the visit.",
      Icon: CalendarCheck,
    },
    {
      title: "Marketing intelligence",
      body: "Profile views, influenced spend, coupons paid, repeat rate, ROAS, and the conversion funnel from view → swipe → claim → visit → story. One dashboard, plain English.",
      Icon: BarChart3,
    },
  ];
  return (
    <section id="venues" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <header className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
              For venues
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              Fill the venue with the guests who move the needle.
            </h2>
          </div>
          <p className="text-muted-foreground max-w-sm text-sm">
            Compete for guests with social presence, not for everyone equally.
            Configure rates by tier, receive organic IG stories, and measure
            every attributed peso.
          </p>
        </header>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => {
            const Icon = it.Icon;
            return (
              <article
                key={it.title}
                className="border-border bg-background flex flex-col gap-3 rounded-2xl border p-6"
              >
                <span className="bg-foreground text-background flex h-10 w-10 items-center justify-center rounded-2xl">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  {it.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {it.body}
                </p>
              </article>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-10 inline-flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="text-secondary h-4 w-4" />
          Setup in 10 minutes. No hardware, no POS, no app for staff —
          everything runs from a browser.
        </p>
      </div>
    </section>
  );
}

// ─── 5. Pricing for Venues ───────────────────────────────────────────────

function Pricing() {
  const plans: {
    id: string;
    name: string;
    price: string;
    cadence: string;
    mechanic: string;
    visibility: string;
    audience: "any" | "formal" | "informal";
    blurb: string;
    bullets: string[];
    featured?: boolean;
  }[] = [
    {
      id: "free",
      name: "Free",
      price: "$0",
      cadence: "MX / month",
      mechanic: "None",
      visibility: "Minimum",
      audience: "any",
      blurb:
        "Auto-listed from Google Business. Discoverable + accepts AI reservations. No coupons, no dashboard writes.",
      bullets: ["Auto-listed", "AI reservations", "No coupon mechanic"],
    },
    {
      id: "formal_pro",
      name: "Formal Pro",
      price: "$400",
      cadence: "MX / month",
      mechanic: "Cashback",
      visibility: "Priority",
      audience: "formal",
      blurb:
        "Cashback on card payments through Mesita. Priority placement across swipe, map, catalog, AI planner.",
      bullets: [
        "Per-tier cashback rates",
        "Mesita wallet — guests redeem at any partner",
        "Story bonus & AI verification",
        "Full Place / Rewards / Wallet / Team dashboard",
      ],
      featured: true,
    },
    {
      id: "informal_pro",
      name: "Informal Pro",
      price: "$800",
      cadence: "MX / month",
      mechanic: "Discount",
      visibility: "Priority",
      audience: "informal",
      blurb:
        "Instant discount on the cash bill. Priority placement. 2× formal because Mesita captures no wallet / data.",
      bullets: [
        "Per-tier discount rates",
        "Discount revealed at the bill — cash or card",
        "Story bonus & AI verification",
        "Place / Rewards / Team dashboard",
      ],
      featured: true,
    },
  ];

  return (
    <section id="pricing" className="border-border border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <header className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
              Pricing
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              Three plans. Per venue. Cancel anytime.
            </h2>
          </div>
          <p className="text-muted-foreground max-w-sm text-sm">
            The coupon mechanic is pinned by your fiscal type — Formal partners
            run cashback, Informal partners run instant discount. Switch fiscal
            type and the plan list re-narrows.
          </p>
        </header>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <Card
              key={p.id}
              className={
                p.featured
                  ? "border-foreground shadow-elev relative gap-3 rounded-2xl"
                  : "relative gap-3 rounded-2xl"
              }
            >
              {p.featured && (
                <Badge className="bg-pink-gradient shadow-glow absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
                  Featured
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="font-display text-2xl font-semibold tracking-tight">
                  {p.name}
                </CardTitle>
                <p className="font-display text-4xl font-bold tabular-nums">
                  {p.price}
                  <span className="text-muted-foreground ml-1 text-sm font-normal">
                    {p.cadence}
                  </span>
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="rounded-full">
                    {p.mechanic}
                  </Badge>
                  <Badge variant="secondary" className="rounded-full">
                    {p.visibility} visibility
                  </Badge>
                </div>
                <CardDescription className="text-[13px] leading-relaxed">
                  {p.blurb}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <ul className="flex flex-1 flex-col gap-1.5 text-[12px]">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 leading-snug">
                      <CheckCircle2 className="text-secondary mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  size="lg"
                  variant={p.featured ? "default" : "outline"}
                  className={
                    p.featured
                      ? "bg-pink-gradient shadow-glow rounded-full text-white hover:opacity-90"
                      : "rounded-full"
                  }
                >
                  <Link href="/manager/sign-up">
                    {p.id === "free" ? "Use Free" : "Become a partner"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-muted-foreground mt-10 grid grid-cols-1 gap-3 text-[13px] leading-relaxed md:grid-cols-3">
          <p>
            <span className="text-foreground font-semibold">
              Per-venue billing.
            </span>{" "}
            Multi-unit operators pick a plan per location — different plans per
            venue are fine. Manager accounts are always free.
          </p>
          <p>
            <span className="text-foreground font-semibold">
              Why Informal is 2× Formal.
            </span>{" "}
            Formal partners feed the Mesita wallet — transaction data and a
            redemption network on the back-end. Informal pays more for the same
            priority placement.
          </p>
          <p>
            <span className="text-foreground font-semibold">
              Payment rail rule.
            </span>{" "}
            Cashback only counts when the guest pays by card through Mesita. At
            Informal venues the discount applies at the bill — cash or card,
            either works.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── 6. FAQs ─────────────────────────────────────────────────────────────

function FAQ() {
  const items: { q: string; a: string }[] = [
    {
      q: "Why do Formal venues run cashback and Informal venues run discount?",
      a: "It comes down to whether you invoice. If you do, cashback works clean: the guest pays full price by card, you book it as marketing spend, and the % comes back to their Mesita wallet for a future visit. If you don't invoice, asking the guest to pay full price first (so you can invoice + charge 16% VAT) so they can recover 10% later loses them money. So instead the discount is revealed at the bill and applied to the cash total directly — no invoice, no IVA, the guest just pays less today.",
    },
    {
      q: "Why does Informal Pro cost 2× Formal Pro?",
      a: "Formal partners participate in the Mesita wallet. Every peso of cashback issued lives on as a balance the guest can redeem at any other Formal partner — so the network compounds, and traffic flows between Formal venues that you'd never see in a vacuum. Informal partners offer a standalone discount that doesn't pool across the network the same way. Same priority placement, no shared wallet pull — so Informal pays more for the same surface coverage.",
    },
    {
      q: "What's the difference between a Verified Partner and a Web-Listed venue?",
      a: "Web-Listed venues are scraped automatically from Google Business and appear in discovery with AI reservations enabled — no sign-up, no dashboard, no coupons. Verified Partners signed up at manager.mesita.app and configured their coupon mechanic; they get priority placement and the Membership / Rewards / Analytics / Wallet / Team dashboard.",
    },
    {
      q: "How does a guest reach Silver, Gold, or Diamond?",
      a: "Two paths. The free path is Instagram followers — 1K / 5K / 20K maps to Silver / Gold / Diamond. The paid path is a Mesita subscription that grants the tier upfront: $200 MXN / month for Silver, $500 for Gold, $1,000 for Diamond. There's also a manual appeal path for models, chefs, press, founders, and other local elites.",
    },
    {
      q: "What's the Instagram story step about?",
      a: "Guests whose Silver / Gold / Diamond class came from follower count have to post an IG story tagging the venue to claim their coupon. Mesita's bot auto-verifies the @mention or location tag; ambiguous cases fall through to a waiter who approves or rejects manually. At Formal venues, no story = no cashback (held back until verified). At Informal venues, the discount applies at the bill before verification — that's the only mechanical risk.",
    },
    {
      q: "Do I need hardware or POS integration?",
      a: "No. Setup is ~10 minutes from manager.mesita.app. Your waiters scan the guest's QR from their own phone (WhatsApp bot or web tool), enter the bill, and Mesita does the rest. No POS, no app to install for staff, no new device at the host stand.",
    },
  ];
  return (
    <section id="faq" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-3xl px-5 py-20 md:py-24">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Frequently asked
        </h2>
        <p className="text-muted-foreground mt-3 text-sm">
          Common questions from venue owners deciding whether to partner.
        </p>
        <div className="divide-border border-border bg-background mt-8 divide-y rounded-2xl border">
          {items.map((it) => (
            <details
              key={it.q}
              className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm leading-snug font-semibold">
                {it.q}
                <span
                  aria-hidden
                  className="text-muted-foreground text-base transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">
                {it.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 7. Footer ───────────────────────────────────────────────────────────

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-10 md:flex-row md:items-center md:justify-between">
        <div className="font-display flex items-center gap-2 text-base font-semibold tracking-tight">
          <span aria-hidden className="text-lg">
            🌲
          </span>
          mesita<span className="text-primary">.</span>
        </div>
        <p className="text-muted-foreground text-[12px]">
          © Mesita · {year} · Smart hospitality since 2026 · Made in Monterrey
        </p>
        <nav className="text-muted-foreground flex flex-wrap items-center gap-4 text-[12px]">
          <a href="#guests" className="hover:text-foreground transition">
            For guests
          </a>
          <a href="#venues" className="hover:text-foreground transition">
            For venues
          </a>
          <a href="#pricing" className="hover:text-foreground transition">
            Pricing
          </a>
          <a href="#faq" className="hover:text-foreground transition">
            FAQ
          </a>
          <Link
            href="/manager/sign-in"
            className="hover:text-foreground transition"
          >
            Manager sign-in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
