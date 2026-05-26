import Link from "next/link";

// Centered card chrome shared by sign-in, sign-up, and onboard. Renders
// the hero gradient, the soft pink glow behind the card, the brandmark,
// the title + subtitle, then whatever children the page hands in.

export function AuthShell({
  header,
  children,
}: {
  // Optional top-pinned chrome (used by /onboard, which is
  // authenticated and benefits from the AppHeader's account menu).
  // Sign-in / sign-up leave this null — there's no session to surface
  // and the in-card brandmark is the only nav.
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-hero relative flex min-h-dvh flex-col overflow-hidden">
      {header}
      <div className="relative grid flex-1 place-items-center px-5 py-10">
        <SoftGlow />
        {children}
      </div>
    </div>
  );
}

export function AuthCard({
  title,
  subtitle,
  chip,
  children,
}: {
  title: string;
  subtitle: string;
  // Optional row between the subtitle and the body — used for "Signed in
  // as foo@bar" on the onboard screen or the OAuth-failed banner on
  // sign-in.
  chip?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card-soft shadow-elev border-border relative w-full max-w-[430px] rounded-[28px] border p-9 backdrop-blur-sm sm:p-10">
      <div className="mb-6 text-center">
        <Link
          href="/"
          className="text-foreground inline-flex items-center gap-2 no-underline"
        >
          <span className="bg-peacock shadow-glow flex h-9 w-9 items-center justify-center rounded-full text-base">
            🦚
          </span>
          <span className="font-display text-[21px] font-semibold tracking-[-0.02em]">
            mesita.
          </span>
        </Link>
        <h1 className="font-display mt-5 text-[28px] font-semibold tracking-[-0.02em]">
          {title}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm leading-[1.5]">
          {subtitle}
        </p>
        {chip}
      </div>
      {children}
    </div>
  );
}

function SoftGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-[58%] rounded-full blur-[10px]"
      style={{
        background:
          "radial-gradient(circle, oklch(0.7 0.24 5 / 0.18), transparent 65%)",
      }}
    />
  );
}
