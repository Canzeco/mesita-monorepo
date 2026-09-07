import Link from "next/link";
import { Building2, CheckCircle, CreditCard, Users } from "lucide-react";
import { MesitaLogo } from "@/components/brand/MesitaLogo";

// Two-column enterprise auth shell for the business subdomain — ported from
// web-admin's EnterpriseAuthLayout (same prop shape, same structure), not
// consumer's (which adds a `footer` prop this surface doesn't need).
//
//   - Left  (50% on lg+, hidden on mobile): branded column with factual,
//           not sales, copy — what the console does, not why you should
//           want it. bg-foreground/text-background matches admin's aside
//           exactly and matches business's own solid-surface convention
//           (PRIMARY_BUTTON_CLASS et al. in lib/ui-classes.ts) — not
//           bg-primary/bg-brand, both of which fail AA contrast on body
//           text or have no solid-fill precedent in this app.
//   - Right (50% on lg+, full width on mobile): auth surface — the
//           caller passes title + subtitle + optional chip + children.
//
// No "Mesita" eyebrow above the title (unlike admin's): business's title
// prop is already "Mesita for business", so admin's eyebrow would repeat
// the brand name redundantly.

export function EnterpriseAuthLayout({
  title,
  subtitle,
  chip,
  children,
}: {
  title: string;
  subtitle: string;
  chip?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background min-h-dvh lg:grid lg:grid-cols-2">
      <LandingPane />
      <main className="bg-background relative flex flex-col">
        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-[420px]">
            <header className="mb-7">
              <h1 className="font-display text-3xl leading-tight font-semibold tracking-[-0.02em]">
                {title}
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm leading-[1.55]">
                {subtitle}
              </p>
              {chip}
            </header>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function LandingPane() {
  return (
    <aside className="bg-foreground text-background relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
      <SoftGlow />
      <div className="relative z-10 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center no-underline">
          <MesitaLogo variant="horizontal" className="h-7 w-auto" />
        </Link>
        <span className="type-meta font-bold tracking-[0.14em] text-background/70 uppercase">
          Business
        </span>
      </div>

      <div className="relative z-10 flex flex-col gap-8">
        <h2 className="font-display max-w-[20ch] text-4xl leading-[1.05] font-semibold tracking-[-0.02em] xl:text-5xl">
          The console for your place.
        </h2>
        <ul className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
          <ValueProp
            Icon={CheckCircle}
            title="Verified, not just claimed"
            blurb="Verified status is a review, not a purchase — it tells diners the place is real."
          />
          <ValueProp
            Icon={CreditCard}
            title="Payouts through Stripe Connect"
            blurb="Reward payouts route through your own connected Stripe account."
          />
          <ValueProp
            Icon={Building2}
            title="One console per place"
            blurb="Profile, capabilities, activity, and admin — all four in one place."
          />
          <ValueProp
            Icon={Users}
            title="Owners, editors, viewers"
            blurb="Invite your team with the access level each person actually needs."
          />
        </ul>
      </div>

      <p className="relative z-10 text-xs text-background/70">
        Made in Monterrey · © Mesita
      </p>
    </aside>
  );
}

function ValueProp({
  Icon,
  title,
  blurb,
}: {
  Icon: typeof CheckCircle;
  title: string;
  blurb: string;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
        <Icon className="h-4 w-4" />
      </span>
      <p className="font-display text-sm font-semibold tracking-[-0.01em]">
        {title}
      </p>
      <p className="type-body leading-[1.5] text-background/80">{blurb}</p>
    </li>
  );
}

function SoftGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full bg-white/10 blur-3xl"
    />
  );
}
