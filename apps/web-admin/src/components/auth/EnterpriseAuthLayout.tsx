import Link from "next/link";
import { Database, Eye, ShieldCheck, Wrench } from "lucide-react";
import { MesitaLogo } from "@/components/brand/MesitaLogo";

// Two-column enterprise auth shell for the admin subdomain.
//
//   - Left  (50% on lg+, hidden on mobile): branded marketing column
//           with admin-specific tone (allowlist, MFA, audit, ops tools).
//   - Right (50% on lg+, full width on mobile): auth surface — Google
//           sign-in is the only option; everything else flows through
//           the super_admins allowlist.

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
              <p className="text-muted-foreground text-[10px] font-medium tracking-[0.18em] uppercase">
                Mesita
              </p>
              <h1 className="font-display mt-1.5 text-[30px] leading-tight font-semibold tracking-[-0.02em]">
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
        <span className="text-[10px] font-bold tracking-[0.2em] text-background/70 uppercase">
          Admin
        </span>
      </div>

      <div className="relative z-10 flex flex-col gap-8">
        <h2 className="font-display max-w-[20ch] text-[40px] leading-[1.05] font-semibold tracking-[-0.02em] xl:text-[46px]">
          Internal operations console.
        </h2>
        <ul className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
          <ValueProp
            Icon={ShieldCheck}
            title="Allowlisted only"
            blurb="Access is gated by the super_admins table — every action runs against the caller's identity."
          />
          <ValueProp
            Icon={Database}
            title="Direct catalog tools"
            blurb="Create, update, bulk-edit, search, and inspect place rows without leaving the shell."
          />
          <ValueProp
            Icon={Eye}
            title="Verification queue"
            blurb="Review ownership claims, approve / reject, and audit every decision after the fact."
          />
          <ValueProp
            Icon={Wrench}
            title="Safe danger zone"
            blurb="Database resets and other destructive actions require explicit typed confirmation."
          />
        </ul>
      </div>

      <p className="relative z-10 text-[11.5px] text-background/70">
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
  Icon: typeof ShieldCheck;
  title: string;
  blurb: string;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
        <Icon className="h-4 w-4" />
      </span>
      <p className="font-display text-[15px] font-semibold tracking-[-0.01em]">
        {title}
      </p>
      <p className="text-[12.5px] leading-[1.5] text-background/80">{blurb}</p>
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
