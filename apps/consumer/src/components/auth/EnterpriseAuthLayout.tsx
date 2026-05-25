import Link from "next/link";
import { Camera, MapPin, Sparkles, Wallet } from "lucide-react";

// Two-column enterprise auth shell for the consumer subdomain.
//
//   - Left  (50% on lg+, hidden on mobile): branded marketing column.
//           Mesita brand, consumer-side headline, four value-prop bullets.
//   - Right (50% on lg+, full width on mobile): auth surface — caller
//           passes the title + subtitle + form children, this layout
//           handles the chrome.
//
// The consumer app is mobile-first so the right pane keeps the form
// proportions tight — on mobile the layout collapses to a single
// column and the in-card design carries the whole experience.

export function EnterpriseAuthLayout({
  title,
  subtitle,
  chip,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  chip?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="bg-background min-h-dvh lg:grid lg:grid-cols-2">
      <LandingPane />
      <main className="bg-background relative flex flex-col">
        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-[440px]">
            <header className="mb-7">
              <h1 className="font-display text-[30px] leading-tight font-semibold tracking-[-0.02em]">
                {title}
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm leading-[1.55]">
                {subtitle}
              </p>
              {chip}
            </header>
            {children}
            {footer && (
              <p className="text-muted-foreground mt-7 text-center text-[12.5px]">
                {footer}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function LandingPane() {
  return (
    <aside className="bg-peacock relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
      <SoftGlow />
      <div className="relative z-10 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 no-underline">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-base backdrop-blur">
            🦚
          </span>
          <span className="font-display text-[20px] font-semibold tracking-[-0.02em]">
            mesita.
          </span>
        </Link>
        <span className="text-[10px] font-bold tracking-[0.2em] text-white/70 uppercase">
          For consumers
        </span>
      </div>

      <div className="relative z-10 flex flex-col gap-8">
        <h2 className="font-display max-w-[18ch] text-[40px] leading-[1.05] font-semibold tracking-[-0.02em] xl:text-[46px]">
          Eat where you&apos;d eat anyway.{" "}
          <em className="not-italic underline decoration-white/40 underline-offset-[6px]">
            Get paid for it.
          </em>
        </h2>
        <ul className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
          <ValueProp
            Icon={MapPin}
            title="Discover real places"
            blurb="Swipe and explore venues curated for your tier, your city, your vibe."
          />
          <ValueProp
            Icon={Wallet}
            title="Cashback on every visit"
            blurb="Card payments through Mesita earn cashback in your wallet — usable anywhere."
          />
          <ValueProp
            Icon={Camera}
            title="One story, one boost"
            blurb="Tag the venue in your IG story to unlock the bigger reward. Easy."
          />
          <ValueProp
            Icon={Sparkles}
            title="Tier perks"
            blurb="Bronze → Silver → Gold → Diamond unlock priority access, higher rates, invites."
          />
        </ul>
      </div>

      <p className="relative z-10 text-[11.5px] text-white/70">
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
  Icon: typeof MapPin;
  title: string;
  blurb: string;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
        <Icon className="h-4 w-4 text-white" />
      </span>
      <p className="font-display text-[15px] font-semibold tracking-[-0.01em]">
        {title}
      </p>
      <p className="text-[12.5px] leading-[1.5] text-white/80">{blurb}</p>
    </li>
  );
}

function SoftGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full bg-white/15 blur-3xl"
    />
  );
}
