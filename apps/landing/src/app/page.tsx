import Image from "next/image";
import Link from "next/link";
import {
  Compass,
  CalendarCheck,
  Gift,
  Sparkles,
  TrendingUp,
  Instagram,
  BarChart3,
  Store,
  UserCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Subdomain URLs — landing lives on mesita.ai, consumer + business are
// separate apps. Keep absolute so links work from any environment.
const CONSUMER_URL = "https://consumer.mesita.ai";
// Business auth lives at the subdomain root — `?mode=signup` lands the
// AuthTabs control on the Create account variant. Bare URL renders the
// default Sign in mode.
const BUSINESS_SIGNUP_URL = "https://business.mesita.ai/?mode=signup";
const BUSINESS_SIGNIN_URL = "https://business.mesita.ai/";

// Landing page — single-source-of-truth marketing surface.
//
// Composition is intentionally flat: six sections in order, nothing
// nested. Each section is its own function so the file reads top-to-
// bottom and the section order matches the page order.
//
//   1. <Nav />             Top menu bar
//   2. <Hero />            Headline + download CTAs + product shot
//   3. <ForConsumers />       Solutions for consumers (3 cards)
//   4. <ForVenues />       Solutions for venues (5 cards)
//   5. <FAQ />             Six essentials, expandable
//   6. <Footer />          © Mesita 2026 etc.
//
// Pricing (the three-plan grid + fiscal-type explainer) lives on the
// business app under /unit/<id>/promos — keeping it inside the auth
// surface keeps the public site focused on the value prop.

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      <Nav />
      <Hero />
      <ForConsumers />
      <ForVenues />
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
          <a href="#consumers" className="hover:text-foreground transition">
            Consumers
          </a>
          <a href="#venues" className="hover:text-foreground transition">
            Venues
          </a>
          <a href="#faq" className="hover:text-foreground transition">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="hidden rounded-full sm:inline-flex"
          >
            <Link href={CONSUMER_URL}>Open Mesita</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full">
            <Link href={BUSINESS_SIGNUP_URL}>
              List your venue
              <ArrowRight />
            </Link>
          </Button>
        </div>
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
          The smartest way to go out — rewarded.
        </h1>

        <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed md:text-xl">
          Every bar, café, restaurant, and club in your city — recommended,
          AI-booked, and rewarded in one app. Some consumers are part of the
          product; everyone benefits.
        </p>

        {/* Two-path CTA: symmetric buttons for consumers and venues. Same
            shape, size, hover; the only difference is the color treatment
            so the eye can still tell them apart at a glance. Both routes
            already live on production subdomains. */}
        <div className="mt-2 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          <PathButton
            href={CONSUMER_URL}
            Icon={UserCircle}
            eyebrow="I'm a consumer"
            label="Open Mesita"
            variant="primary"
          />
          <PathButton
            href={BUSINESS_SIGNUP_URL}
            Icon={Store}
            eyebrow="I run a venue"
            label="List your venue"
            variant="dark"
          />
        </div>

        <p className="text-muted-foreground text-xs">
          Free for consumers · Set up your venue in 10 minutes · Rewards on
          every visit
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

function PathButton({
  href,
  Icon,
  eyebrow,
  label,
  variant,
}: {
  href: string;
  Icon: typeof UserCircle;
  eyebrow: string;
  label: string;
  variant: "primary" | "dark";
}) {
  const className =
    variant === "primary"
      ? "bg-pink-gradient shadow-glow text-white"
      : "bg-foreground text-background";
  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center gap-3 rounded-full px-5 py-4 text-left transition hover:opacity-90 ${className}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] tracking-[0.18em] uppercase opacity-80">
          {eyebrow}
        </span>
        <span className="text-[15px] font-semibold">{label}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

// ─── 3. Solutions for Consumers ─────────────────────────────────────────────

function ForConsumers() {
  const items: {
    title: string;
    body: string;
    Icon: typeof Compass;
  }[] = [
    {
      title: "Experience intelligence",
      body: "The most complete catalog in your city — ratings, prices, vibes, photos, and where Bronze, Silver, Gold, and Diamond consumers are going right now. Swipe, map, catalog, or just ask the AI.",
      Icon: Compass,
    },
    {
      title: "AI-booked reservations",
      body: "One tap and Mesita's AI agent contacts the venue for you — voice, IG DM, WhatsApp, web form, or email — and locks in the table. Works at every venue in the city, even ones that never signed with us.",
      Icon: CalendarCheck,
    },
    {
      title: "Classes and rewards",
      body: "Bronze is free for everyone. Earn Silver, Gold, or Diamond through Instagram followers or a Mesita subscription — and unlock bigger discounts at every partner, plus priority tables, private openings, and other perks that scale with your class.",
      Icon: Gift,
    },
  ];
  return (
    <section id="consumers" className="border-border border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <header className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
              For consumers
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              Three things only Mesita gives you.
            </h2>
          </div>
          <p className="text-muted-foreground max-w-sm text-sm">
            Mesita Bronze is free forever. Silver, Gold, and Diamond grant
            bigger discounts at every partner — earned with Instagram followers
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
        <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground inline-flex items-center gap-2 text-[13px]">
            <CheckCircle2 className="text-secondary h-4 w-4" />
            Free forever. No download required for the web.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-pink-gradient shadow-glow rounded-full text-white hover:opacity-90"
          >
            <Link href={CONSUMER_URL}>
              Open Mesita
              <ArrowRight />
            </Link>
          </Button>
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
      body: "Set discount rates per tier — Bronze, Silver, Gold, Diamond. Reward the consumers who actually fill the room and post it to thousands; pay base rates to walk-ins.",
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
              Fill the venue with the consumers who move the needle.
            </h2>
          </div>
          <p className="text-muted-foreground max-w-sm text-sm">
            Compete for consumers with social presence, not for everyone
            equally. Configure rates by tier, receive organic IG stories, and
            measure every attributed peso.
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
        <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground inline-flex items-center gap-2 text-[13px]">
            <CheckCircle2 className="text-secondary h-4 w-4" />
            Setup in 10 minutes. No hardware, no POS, no app for staff.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-foreground text-background hover:bg-foreground rounded-full hover:opacity-90"
          >
            <Link href={BUSINESS_SIGNUP_URL}>
              List your venue
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── 5. FAQs ─────────────────────────────────────────────────────────────

function FAQ() {
  const items: { q: string; a: string }[] = [
    {
      q: "How does the Mesita discount work?",
      a: "Every Verified venue runs an instant discount that's revealed at the bill and applied to the total directly — no invoice, no IVA, no waiting. The consumer scans their QR, your staff enters the bill, and Mesita applies the agreed % on the spot. The consumer just pays less today, and you only reward the visits that actually happen.",
    },
    {
      q: "What's the difference between a Verified Partner and a Web-Listed venue?",
      a: "Web-Listed venues are scraped automatically from Google Business and appear in discovery with AI reservations enabled — no sign-up, no dashboard, no coupons. Verified Partners signed up at business.mesita.ai and configured their coupon mechanic; they get priority placement and the Membership / Rewards / Analytics / Team dashboard.",
    },
    {
      q: "How does a consumer reach Silver, Gold, or Diamond?",
      a: "Two paths. The free path is Instagram followers — 1K / 5K / 20K maps to Silver / Gold / Diamond. The paid path is a Mesita subscription that grants the tier upfront: $200 MXN / month for Silver, $500 for Gold, $1,000 for Diamond. There's also a manual appeal path for models, chefs, press, founders, and other local elites.",
    },
    {
      q: "What's the Instagram story step about?",
      a: "Consumers whose Silver / Gold / Diamond class came from follower count have to post an IG story tagging the venue to claim their reward. Mesita's bot auto-verifies the @mention or location tag; ambiguous cases fall through to a waiter who approves or rejects manually. The discount is applied at the bill before verification clears — that's the only mechanical risk.",
    },
    {
      q: "Do I need hardware or POS integration?",
      a: "No. Setup is ~10 minutes from business.mesita.ai. Your waiters scan the consumer's QR from their own phone (WhatsApp bot or web tool), enter the bill, and Mesita does the rest. No POS, no app to install for staff, no new device at the host stand.",
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

// ─── 6. Footer ───────────────────────────────────────────────────────────

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
          <a href="#consumers" className="hover:text-foreground transition">
            For consumers
          </a>
          <a href="#venues" className="hover:text-foreground transition">
            For venues
          </a>
          <a href="#faq" className="hover:text-foreground transition">
            FAQ
          </a>
          <Link
            href={BUSINESS_SIGNIN_URL}
            className="hover:text-foreground transition"
          >
            Business sign-in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
