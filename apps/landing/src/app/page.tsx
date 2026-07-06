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
  QrCode,
  Receipt,
  BadgeCheck,
  ScanLine,
  CreditCard,
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
// Composition is intentionally flat: each section is its own function so
// the file reads top-to-bottom and the section order matches the page
// order. Rebuilt to tell the full dual-sided story from the Notion Main
// page, in current nomenclature (Places · Listed/Verified · plans
// Free/Pro/Ultra · reward tickets · instant discount at the bill).
//
//   1. <Nav />              Top menu bar
//   2. <Hero />             Headline + two-path CTA + product shot
//   3. <MoatStrip />        "Every place already inside" band + dual framing
//   4. <ForDiners />        Four consumer UVPs
//   5. <HowRewards />       The reward mechanic in 3 steps + Premium doors
//   6. <ForPlaces />        Five place UVPs + Listed vs Verified
//   7. <FAQ />              Six essentials, expandable
//   8. <FinalCTA />         Slim dual-path repeat
//   9. <Footer />           © Mesita 2026 etc.
//
// Pricing stays off the public site by design — the three-plan grid lives
// inside the business auth surface. The page sells the value prop, not the
// price sheet.

export default function Home() {
  return (
    <main className="bg-background min-h-screen">
      <Nav />
      <Hero />
      <MoatStrip />
      <ForDiners />
      <HowRewards />
      <ForPlaces />
      <FAQ />
      <FinalCTA />
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
          <a href="#diners" className="hover:text-foreground transition">
            Diners
          </a>
          <a href="#how" className="hover:text-foreground transition">
            How it works
          </a>
          <a href="#places" className="hover:text-foreground transition">
            Places
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
              List your place
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
          Where should we go tonight?
          <br />
          <span className="text-primary">Answered — and rewarded.</span>
        </h1>

        <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed md:text-xl">
          Every bar, café, restaurant, and club in your city — discovered by AI,
          booked by AI, and cheaper every time you go. One app for both sides of
          the table.
        </p>

        {/* Two-path CTA: symmetric buttons for diners and places. Same
            shape, size, hover; only the color treatment differs so the eye
            can tell them apart. Both routes live on production subdomains. */}
        <div className="mt-2 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          <PathButton
            href={CONSUMER_URL}
            Icon={UserCircle}
            eyebrow="I'm going out"
            label="Open Mesita"
            variant="primary"
          />
          <PathButton
            href={BUSINESS_SIGNUP_URL}
            Icon={Store}
            eyebrow="I run a place"
            label="List your place"
            variant="dark"
          />
        </div>

        <p className="text-muted-foreground text-xs">
          Free for diners · Set up your place in 10 minutes · A discount on
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

// ─── 3. Moat strip ───────────────────────────────────────────────────────
// The differentiator, stated up front: the catalog is already complete, so
// diners never hit an empty app and places don't "join" — they upgrade a
// profile that already exists. Also carries the two-sided framing.

function MoatStrip() {
  const points: { stat: string; label: string }[] = [
    { stat: "Every place", label: "in your city, already inside" },
    { stat: "0 sign-ups", label: "needed — AI books at all of them" },
    { stat: "~100×", label: "bigger catalog than sign-up apps" },
  ];
  return (
    <section className="border-border bg-background border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 md:py-14">
        <p className="text-muted-foreground mx-auto max-w-2xl text-center text-sm md:text-base">
          Mesita starts full. Every restaurant, café, bar, and club is
          auto-sourced and enriched by AI — photos, menus, hours, vibe — so a
          place&apos;s choice isn&apos;t{" "}
          <span className="text-foreground font-medium">join Mesita</span> but{" "}
          <span className="text-foreground font-medium">
            upgrade the profile it already has
          </span>
          .
        </p>
        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {points.map((p) => (
            <div
              key={p.stat}
              className="border-border bg-card flex flex-col items-center gap-1 rounded-2xl border px-4 py-5 text-center"
            >
              <span className="font-display text-primary text-2xl font-semibold tracking-tight">
                {p.stat}
              </span>
              <span className="text-muted-foreground text-xs leading-snug">
                {p.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 4. For Diners ───────────────────────────────────────────────────────

function ForDiners() {
  const items: { title: string; body: string; Icon: typeof Compass }[] = [
    {
      title: "The complete catalog",
      body: "Every restaurant, café, bar, and club in the city — each with the best-researched profile in the market: photos, menus, hours, ratings, and vibe, built automatically. Nothing missing, nothing to wait for.",
      Icon: Compass,
    },
    {
      title: "Discovery intelligence",
      body: "One brain ranks every place by vibe, zone, budget, and who's out right now. Swipe tonight's matches, browse the live map, search everything, or just ask the AI concierge — “rooftop date tonight under $$$.”",
      Icon: Sparkles,
    },
    {
      title: "A discount on every visit",
      body: "Just by using Mesita you pay less: a Welcome discount your first time, a Returning discount every time after — applied straight to the bill. You pay the place directly; Mesita never touches your money.",
      Icon: Gift,
    },
    {
      title: "AI-booked reservations",
      body: "Set party size and time; Mesita's AI agent books the table over whatever channel the place runs — voice, Instagram DM, WhatsApp, web form, or email. It works at every place in the city, not just partners.",
      Icon: CalendarCheck,
    },
  ];
  return (
    <section id="diners" className="border-border border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="For diners"
          title="Answer “where should we go?” — and save doing it."
          aside="Mesita is free forever. Premium unlocks bigger discounts everywhere — earned free with Instagram, or $100 MXN / month."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((it) => (
            <FeatureCard
              key={it.title}
              {...it}
              iconClass="bg-primary/10 text-primary"
            />
          ))}
        </div>
        <SectionFooter
          note="Free forever. No download required on the web."
          cta={{ href: CONSUMER_URL, label: "Open Mesita" }}
          variant="primary"
        />
      </div>
    </section>
  );
}

// ─── 5. How rewards work ─────────────────────────────────────────────────
// The reward mechanic, demystified: three steps at the table, plus the three
// doors into Premium. Concrete beats abstract — this is what removes doubt.

function HowRewards() {
  const steps: {
    n: string;
    title: string;
    body: string;
    Icon: typeof QrCode;
  }[] = [
    {
      n: "1",
      title: "Scan your QR",
      body: "Staff scans the QR on your Mesita card. No app for them to install — it runs over WhatsApp or the web.",
      Icon: QrCode,
    },
    {
      n: "2",
      title: "They enter the bill",
      body: "Mesita applies your agreed discount — 10–70% — on the spot and shows the new total to you and the staff.",
      Icon: Receipt,
    },
    {
      n: "3",
      title: "You pay less, directly",
      body: "Pay the place by any method, cash or card. Mesita never holds the money — no settlement, no waiting.",
      Icon: CreditCard,
    },
  ];
  const doors: { title: string; body: string; Icon: typeof Instagram }[] = [
    {
      title: "Instagram",
      body: "Verify a 1K+ follower account — free. Post a story tagging the place to release the reward.",
      Icon: Instagram,
    },
    {
      title: "Subscription",
      body: "$100 MXN / month via Stripe. Bigger discounts everywhere, and never a story to post.",
      Icon: BadgeCheck,
    },
    {
      title: "Invitation",
      body: "Granted to local figures — chefs, models, press, founders — the guests places want in the room.",
      Icon: Sparkles,
    },
  ];
  return (
    <section id="how" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="How rewards work"
          title="A real discount, applied at the bill."
          aside="No cashback, no wallet, no invoice. The place funds its own discount and you just pay less today."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((s) => {
            const Icon = s.Icon;
            return (
              <article
                key={s.n}
                className="border-border bg-background relative flex flex-col gap-3 rounded-2xl border p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="bg-pink-gradient flex h-10 w-10 items-center justify-center rounded-2xl text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-muted-foreground/40 text-4xl font-semibold">
                    {s.n}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  {s.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {s.body}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-10">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            Three doors to Premium
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {doors.map((d) => {
              const Icon = d.Icon;
              return (
                <article
                  key={d.title}
                  className="border-border bg-background flex items-start gap-3 rounded-2xl border p-5"
                >
                  <span className="bg-secondary/10 text-secondary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-semibold">{d.title}</h4>
                    <p className="text-muted-foreground text-[13px] leading-relaxed">
                      {d.body}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 6. For Places ───────────────────────────────────────────────────────

function ForPlaces() {
  const items: { title: string; body: string; Icon: typeof TrendingUp }[] = [
    {
      title: "New customers",
      body: "Verifying lifts you above the ~100× larger Listed pool on every discovery surface — you show up first at the exact moment someone's deciding where to go. The Welcome discount converts that into first visits.",
      Icon: TrendingUp,
    },
    {
      title: "The customers who fill the room",
      body: "Set one rate for everyone and a bigger one for Premium — the magnetic (high Instagram reach) and the committed (paying members). Court the guests who move the needle; pay base rates to walk-ins.",
      Icon: Sparkles,
    },
    {
      title: "Guaranteed Instagram reach",
      body: "Instagram-door guests post a story tagging you to unlock their reward, and Mesita verifies it — automatically for public accounts, screenshot + one staff tap for private. Real, measured reach before you give anything up.",
      Icon: Instagram,
    },
    {
      title: "Easier reservations",
      body: "AI-relayed bookings come in through channels you already run — phone, WhatsApp, Instagram, email — or connect OpenTable for live availability. Nothing to install, and you see party size and class before the visit.",
      Icon: CalendarCheck,
    },
    {
      title: "Marketing intelligence",
      body: "One dashboard: views, the full funnel — views → swipes → rewards → visits → stories — influenced spend, average ticket, repeat rate, and ROAS, with an AI copilot that drafts your next promo.",
      Icon: BarChart3,
    },
  ];
  return (
    <section id="places" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="For places"
          title="Fill the room with the guests who move the needle."
          aside="A customer-acquisition channel with no hardware and no setup. Compete for high-value guests, not for everyone equally."
        />

        <ListedVsVerified />

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => (
            <FeatureCard
              key={it.title}
              {...it}
              iconClass="bg-foreground text-background"
            />
          ))}
        </div>
        <SectionFooter
          note="Setup in 10 minutes. No hardware, no POS, no app for staff."
          cta={{ href: BUSINESS_SIGNUP_URL, label: "List your place" }}
          variant="dark"
        />
      </div>
    </section>
  );
}

// Compact two-up explainer: what a place gets before vs. after it claims.
function ListedVsVerified() {
  return (
    <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="border-border bg-background/60 rounded-2xl border border-dashed p-6">
        <div className="flex items-center gap-2">
          <ScanLine className="text-muted-foreground h-4 w-4" />
          <h3 className="font-display text-base font-semibold tracking-tight">
            Listed
          </h3>
          <Badge
            variant="outline"
            className="text-muted-foreground ml-auto rounded-full text-[10px]"
          >
            Auto-sourced
          </Badge>
        </div>
        <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">
          Built for you from public data — discoverable and AI-bookable, at no
          cost and no sign-up. No rewards, no dashboard.
        </p>
      </div>
      <div className="border-primary/30 bg-background shadow-elev rounded-2xl border p-6">
        <div className="flex items-center gap-2">
          <BadgeCheck className="text-primary h-4 w-4" />
          <h3 className="font-display text-base font-semibold tracking-tight">
            Verified
          </h3>
          <Badge className="bg-pink-gradient ml-auto rounded-full border-0 text-[10px] text-white">
            You claim it
          </Badge>
        </div>
        <p className="text-muted-foreground mt-3 text-[13px] leading-relaxed">
          Claim your profile to run rewards, set per-class discounts and story
          bonuses, get priority placement everywhere, and open the full
          dashboard.
        </p>
      </div>
    </div>
  );
}

// ─── 7. FAQ ──────────────────────────────────────────────────────────────

function FAQ() {
  const items: { q: string; a: string }[] = [
    {
      q: "How does the Mesita discount work?",
      a: "Every Verified place runs an instant discount applied right at the bill — no invoice, no VAT handling, no waiting. The diner scans their QR, staff enters the bill, and Mesita applies the agreed % on the spot. The diner pays the place directly, so you only reward the visits that actually happen. Mesita never touches the money.",
    },
    {
      q: "What's the difference between a Listed and a Verified place?",
      a: "Listed places are auto-sourced from public data and appear in discovery with AI reservations enabled — no sign-up, no dashboard, no rewards. Verified places have claimed their profile at business.mesita.ai and configured their rewards; they get priority placement and the full Place / Promos / Analytics / Team dashboard.",
    },
    {
      q: "What's the difference between Free and Premium for diners?",
      a: "Every diner starts Free — full discovery, AI reservations, and a discount at every Verified place. Premium unlocks bigger discounts everywhere, through three doors: verify a 1K+ Instagram account (free — post a story tagging the place), subscribe for $100 MXN / month (no story ever), or receive an invitation reserved for local figures like chefs, models, press, and founders.",
    },
    {
      q: "What's the Instagram story step about?",
      a: "Instagram-door Premium guests post a story tagging the place to release their reward. Mesita auto-verifies the @mention for public accounts; private accounts submit a screenshot that one staff member confirms. Subscription- and invitation-door guests are exempt — no story ever.",
    },
    {
      q: "Do places need hardware or a POS integration?",
      a: "No. Setup is about 10 minutes at business.mesita.ai. Staff scan the diner's QR from their own phone — over WhatsApp or the web — enter the bill, and Mesita does the rest. No POS, no app to install, no new device at the host stand.",
    },
    {
      q: "Does Mesita hold or move any money?",
      a: "Never. Mesita is a subscription product, not a marketplace — no cashback, no wallet, no settlement. The discount is the place's own marketing spend, applied at its own bill, and the diner pays the place directly by any method. That's what keeps it simple and out of money-transmission territory.",
    },
  ];
  return (
    <section id="faq" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-3xl px-5 py-20 md:py-24">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Frequently asked
        </h2>
        <p className="text-muted-foreground mt-3 text-sm">
          The essentials for diners and place owners alike.
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

// ─── 8. Final CTA ────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="bg-hero border-border border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 py-20 text-center md:py-24">
        <h2 className="font-display max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          Two sides of the table. One app.
        </h2>
        <p className="text-muted-foreground max-w-xl text-base">
          Diners discover and save. Places fill the room with the guests who
          matter. Pick your side.
        </p>
        <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          <PathButton
            href={CONSUMER_URL}
            Icon={UserCircle}
            eyebrow="I'm going out"
            label="Open Mesita"
            variant="primary"
          />
          <PathButton
            href={BUSINESS_SIGNUP_URL}
            Icon={Store}
            eyebrow="I run a place"
            label="List your place"
            variant="dark"
          />
        </div>
      </div>
    </section>
  );
}

// ─── 9. Footer ───────────────────────────────────────────────────────────

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
          <a href="#diners" className="hover:text-foreground transition">
            For diners
          </a>
          <a href="#places" className="hover:text-foreground transition">
            For places
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

// ─── Shared pieces ───────────────────────────────────────────────────────

function SectionHeader({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside: string;
}) {
  return (
    <header className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          {eyebrow}
        </p>
        <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h2>
      </div>
      <p className="text-muted-foreground max-w-sm text-sm">{aside}</p>
    </header>
  );
}

function FeatureCard({
  title,
  body,
  Icon,
  iconClass,
}: {
  title: string;
  body: string;
  Icon: typeof Compass;
  iconClass: string;
}) {
  return (
    <article className="border-border bg-background flex flex-col gap-3 rounded-2xl border p-6">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconClass}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="font-display text-xl font-semibold tracking-tight">
        {title}
      </h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
    </article>
  );
}

function SectionFooter({
  note,
  cta,
  variant,
}: {
  note: string;
  cta: { href: string; label: string };
  variant: "primary" | "dark";
}) {
  const btnClass =
    variant === "primary"
      ? "bg-pink-gradient shadow-glow rounded-full text-white hover:opacity-90"
      : "bg-foreground text-background hover:bg-foreground rounded-full hover:opacity-90";
  return (
    <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground inline-flex items-center gap-2 text-[13px]">
        <CheckCircle2 className="text-secondary h-4 w-4" />
        {note}
      </p>
      <Button asChild size="lg" className={btnClass}>
        <Link href={cta.href}>
          {cta.label}
          <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
