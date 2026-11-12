import Image from "next/image";
import { redirect } from "next/navigation";
import { Outfit } from "next/font/google";
import { createServerSupabase } from "@/lib/supabase/server";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { safeNextPath } from "@/lib/safe-next";

// The Business app's front door, a landing before sign-in (Pato, MESITA-3663:
// "generate also the pre-auth landing for the business console"). Google
// accounts only (Pato, 2026-11-02, MESITA-3105): owners and Mesita staff both
// sign in with Google, and every business-web-* door refuses any other
// session (`google_only`).
//
//   no session → the landing, its buttons all Google sign-in.
//   session    → /auth/post-signin, which routes to the place or the claim.
//
// `next` (a deep link, e.g. the consumer app's "Is this your business?") is
// parked in a short cookie by the edge wall, because the OAuth callback
// cannot carry it.
//
// THE HEADLINE IS MESITA'S OWN. Pato asked for inKind Capital's slogan
// ("Capital that comes with customers"); that line is a competitor's own
// headline, so the page says the same idea in its own words. Every claim
// is one the product makes today: guests prepay with a bonus, the payment
// goes to the place's own Stripe account, the credit spends only there.

export const dynamic = "force-dynamic";

// The word "Mesita" in Outfit, as the console's rail and the consumer app
// write it; the headline in its heaviest cut.
const display = Outfit({ subsets: ["latin"], weight: ["700", "800"] });

const ERROR_COPY: Record<string, string> = {
  oauth_failed: "Google sign-in failed. Try again.",
  google_only: "Mesita for places signs in with a Google account. Sign in with Google to continue.",
};

const STEPS = [
  {
    title: "Guests prepay",
    body: "A guest buys credit at your place in the Mesita app, with a bonus on top.",
  },
  {
    title: "You get paid now",
    body: "The payment goes to your own Stripe account when they buy, not when they eat.",
  },
  {
    title: "They come back to spend it",
    body: "Credit only spends at your place, so every prepay is a visit already on its way.",
  },
] as const;

const WRAP = "mx-auto w-full max-w-[1240px] px-5 sm:px-8";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next ? `/auth/post-signin?next=${encodeURIComponent(next)}` : "/auth/post-signin");

  const errorMessage = params.error ? ERROR_COPY[params.error] : null;

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="bg-black text-white">
        <div className={`${WRAP} flex items-center justify-between gap-4 py-4`}>
          <span className="flex items-center gap-2.5">
            <MesitaMark className="h-7 w-7" />
            <span className={`${display.className} text-2xl leading-none tracking-[-0.03em]`}>
              Mesita
            </span>
            <span className="ml-1 hidden border-l border-white/25 pl-2.5 text-sm text-white/65 sm:inline">
              for places
            </span>
          </span>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <a href="#how" className="hidden text-white/85 hover:text-white sm:inline">
              How it works
            </a>
            <div className="w-auto">
              <GoogleSignInButton
                label="Sign in"
                className="h-10 bg-white px-5 text-black hover:bg-white/90"
              />
            </div>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-black text-white">
        <Image
          src="/landing/terrace.jpg"
          alt="Friends sharing tacos on a Monterrey terrace at dusk"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_42%]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.82)_0%,rgba(0,0,0,.6)_45%,rgba(0,0,0,.15)_100%),linear-gradient(0deg,rgba(0,0,0,.55),transparent_40%)]"
        />
        <div className={`${WRAP} relative py-20 sm:py-28 lg:py-36`}>
          <h1
            className={`${display.className} max-w-[11ch] text-[clamp(46px,7.4vw,104px)] leading-[0.92] font-extrabold tracking-[-0.035em] uppercase`}
          >
            Money up front. <span className="text-emerald-400">Guests at the table.</span>
          </h1>
          <p className="mt-7 mb-9 max-w-[46ch] text-lg leading-relaxed text-white/90 sm:text-xl">
            Guests prepay at your place through Mesita and come back to spend it. You get the
            money today, and the people who will spend it.
          </p>
          {errorMessage ? (
            <p className={`${ERROR_BOX_CLASS} mb-5 max-w-md leading-relaxed`}>{errorMessage}</p>
          ) : null}
          <div className="flex flex-wrap items-start gap-3.5">
            <div className="w-full max-w-xs sm:w-auto">
              <GoogleSignInButton className="h-14 w-full bg-white px-7 text-base text-black hover:bg-white/90 sm:w-auto" />
            </div>
            <a
              href="#how"
              className="inline-flex h-14 items-center justify-center rounded-full px-7 text-base font-semibold text-white ring-2 ring-white/55 transition ring-inset hover:bg-white/10"
            >
              See how it works
            </a>
          </div>
          <p className="mt-6 text-sm text-white/70">
            Paid to your own Stripe account · Start on the Free plan
          </p>
        </div>
      </section>

      <section id="how" className={`${WRAP} scroll-mt-4 py-16 sm:py-24`}>
        <p className="type-eyebrow text-muted-foreground mb-3">
          How it works
        </p>
        <h2
          className={`${display.className} mb-10 max-w-[20ch] text-[clamp(30px,3.6vw,48px)] leading-[1.05] font-bold tracking-[-0.03em] text-balance`}
        >
          The money comes first. The table fills after.
        </h2>
        <ol className="border-foreground grid grid-cols-1 border-t-2 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="border-border flex flex-col gap-2.5 py-6 not-first:border-t md:pr-7 md:not-first:border-t-0 md:not-first:border-l md:not-first:pl-7"
            >
              <span
                className={`${display.className} text-muted-foreground text-sm font-bold tabular-nums`}
              >
                {i + 1}
              </span>
              <h3 className={`${display.className} text-xl font-bold tracking-[-0.02em]`}>
                {step.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-muted">
        <div className={`${WRAP} flex flex-wrap items-center justify-between gap-5 py-11`}>
          <p
            className={`${display.className} max-w-[26ch] text-[clamp(22px,2.4vw,30px)] leading-tight font-bold tracking-[-0.02em]`}
          >
            Claim your place on Mesita. Free to start; Pro and Max when you want more.
          </p>
          <div className="w-full max-w-xs sm:w-auto">
            <GoogleSignInButton className="bg-foreground text-background h-13 w-full px-7 text-base hover:opacity-90 sm:w-auto" />
          </div>
        </div>
      </section>

      <footer className={`${WRAP} text-muted-foreground flex flex-wrap justify-between gap-3 py-7 text-xs`}>
        <span>Made in Monterrey · © Mesita</span>
        <span>Google accounts only</span>
      </footer>
    </div>
  );
}
