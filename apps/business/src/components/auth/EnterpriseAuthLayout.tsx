import Link from "next/link";
import { BarChart3, Camera, Search, Star } from "lucide-react";

// Two-column enterprise auth shell.
//
//   - Left  (50% on lg+, hidden on mobile): branded marketing column.
//           Brand, headline, four value-prop bullets, footer fineprint.
//   - Right (50% on lg+, full width on mobile): auth surface — caller
//           passes the title + subtitle + form children, this layout
//           handles the chrome.
//
// Used only by `/` — that page hosts both Sign in and Create account
// via the AuthTabs control. The right pane keeps the same max-width
// as the old centered AuthShell so the form proportions don't change.

export function EnterpriseAuthLayout({
  title,
  subtitle,
  chip,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  // Optional inline row between subtitle and form (e.g. OAuth-failed
  // banner, "Signed in as foo@bar" breadcrumb).
  chip?: React.ReactNode;
  children: React.ReactNode;
  // Optional footer under the form (e.g. "Already a partner? Sign in").
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

// Branded left column. Pink gradient background, brand at the top, hero
// headline, value props. Hidden under lg so the form takes the whole
// viewport on mobile — the landing pane is supplemental, not load-
// bearing.
function LandingPane() {
  return (
    <aside className="bg-pink-gradient relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
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
          For venues
        </span>
      </div>

      <div className="relative z-10 flex flex-col gap-8">
        <h2 className="font-display max-w-[18ch] text-[40px] leading-[1.05] font-semibold tracking-[-0.02em] xl:text-[46px]">
          Turn who walks in into a{" "}
          <em className="not-italic underline decoration-white/40 underline-offset-[6px]">
            lever you can pull.
          </em>
        </h2>
        <ul className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
          <ValueProp
            Icon={Search}
            title="Get discovered"
            blurb="Priority placement over web-only venues across swipe, catalog, map, AI search."
          />
          <ValueProp
            Icon={Star}
            title="Win magnetic guests"
            blurb="Per-tier cashback or discount rates so high-spend regulars are worth chasing."
          />
          <ValueProp
            Icon={Camera}
            title="Verified IG stories"
            blurb="AI confirms the tagged story before the reward unlocks — real reach, real ROI."
          />
          <ValueProp
            Icon={BarChart3}
            title="One dashboard"
            blurb="Influenced spend, conversion funnel, tier-source split, ROAS — with a copilot."
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
  Icon: typeof Search;
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

// Tiny pill between the auth heading and the form. Two tones: "muted"
// for the signed-in-as breadcrumb, "error" for the OAuth-failed notice.
// Re-exported here so callers don't have to import from AuthShell when
// they're using the enterprise layout.
export function AuthChip({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "error";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "bg-destructive/10 text-destructive"
      : "text-muted-foreground bg-muted/60";
  return (
    <p
      className={
        "mt-3 inline-block rounded-full px-3 py-1 text-[11.5px] " + cls
      }
    >
      {children}
    </p>
  );
}
