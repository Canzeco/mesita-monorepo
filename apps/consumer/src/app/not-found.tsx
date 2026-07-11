import Link from "next/link";
import { Compass, MoveLeft } from "lucide-react";

// Global 404 for the consumer app. Any path that doesn't match a route
// renders here (wrapped in the root layout only — no shell chrome), so a
// mistyped or dead URL lands on a branded page instead of Next's raw
// default 404.
//
// The single CTA points at "/" on purpose: it's the one entry point that
// routes correctly for BOTH states — signed-out visitors see the auth
// surface, signed-in visitors get bounced through /auth/post-signin to
// /home or /onboard. Hard-coding /home instead would wrongly send a
// signed-out user into the auth wall.

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="bg-hero flex min-h-dvh w-full flex-col items-center justify-center px-6 py-16 text-center">
      <div className="border-border bg-card/90 w-full max-w-sm rounded-3xl border px-6 py-10 shadow-[0_20px_48px_-24px_rgba(15,10,40,0.35)] backdrop-blur">
        <div className="bg-peacock shadow-glow mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl text-white">
          <Compass className="h-6 w-6" />
        </div>
        <p className="text-muted-foreground text-xs font-bold tracking-[0.2em] uppercase">
          Error 404
        </p>
        <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
          This page doesn&apos;t exist
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          The link may be broken or the page may have moved. Let&apos;s get you
          back to Mesita.
        </p>
        <Link
          href="/"
          className="bg-pink-gradient shadow-glow mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white transition active:scale-[0.99]"
        >
          <MoveLeft className="h-4 w-4" />
          Back to Mesita
        </Link>
      </div>
    </main>
  );
}
