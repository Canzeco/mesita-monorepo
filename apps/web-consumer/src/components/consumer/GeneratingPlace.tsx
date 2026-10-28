"use client";

// GENERATING A PROFILE (Pato, MESITA-2935: "don't show this ugly ass ui …
// show something simpler indicating that the place is being created"; "use
// word generate, it feels more AI, and use AI icon"). One calm view while
// get-or-create runs: the sparkles tile, "Generating profile…", the place's
// name and address, and one line that names the step. It replaced the draft
// profile (a blue Creating fact, "-" stats, Reserve and an empty Overview)
// that told a guest a place was new only after they opened it — nearby
// search is gone, and the row they tapped already said Generate. Drawn by
// the opening route (OpeningGooglePlace, its loading files) for Home,
// Favorites and deep links; Search's Generate dialog shares the steps.
//
// THE WAIT IS ABOUT TEN SECONDS, MEASURED (2026-10-28 logs: a new place is
// 6.6–12.9 s; one Mesita holds, under 1 s), so the view says so and names
// the step the create is on. The steps are the create run's own
// (_shared/create-place.ts): Google's details and first photo, then the
// door Description (the AI writes tags and the summary), then the embedding.
// They advance on a timer, never past the last, and nothing else moves: the
// icon is still, the line is the one motion (design review D4, D8).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { PlaceTopBar } from "@mesita/place-profile";
import { useSlideOverClose } from "@/components/consumer/overlay/SlideOverShell";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { PRIMARY_BUTTON_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/** The create run's steps and when each line shows (ms after the tap). */
const STEPS = [
  { at: 0, label: "Reading Google's listing" },
  { at: 3000, label: "Writing its profile" },
  { at: 8000, label: "Almost ready" },
] as const;

/** The step line. Mount it when the create starts; it never runs past the
 *  last step, so a slow create rests on "Almost ready". */
export function GenerateSteps({ className }: { className?: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = STEPS.slice(1).map((s, i) =>
      window.setTimeout(() => setStep(i + 1), s.at),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);
  return (
    <span className={cn("flex flex-col items-center", className)}>
      <span
        key={step}
        className="text-foreground animate-in fade-in text-sm font-semibold duration-300 motion-reduce:animate-none"
      >
        {STEPS[step].label}…
      </span>
      <span className="text-muted-foreground mt-0.5 text-xs">
        About 10 seconds
      </span>
    </span>
  );
}

/** The sparkles tile every Generate surface leads with. */
export function GenerateTile({ muted = false }: { muted?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-2xl",
        muted ? "bg-muted text-muted-foreground" : "bg-foreground text-paper",
      )}
    >
      <Sparkles className="h-6 w-6" strokeWidth={2} aria-hidden />
    </span>
  );
}

export function GeneratingPlace({
  name,
  address,
  error,
  onRetry,
  attempt = 0,
}: {
  name?: string | null;
  address?: string | null;
  /** A refusal: the message replaces the steps, with Try again. */
  error?: string | null;
  onRetry?: () => void;
  /** Restarts the steps on a retry. */
  attempt?: number;
}) {
  const failed = Boolean(error);
  return (
    <div
      className="flex flex-col items-center px-6 text-center"
      role="status"
      aria-live="polite"
      aria-busy={!failed}
      data-generating-place={failed ? "failed" : "running"}
    >
      <GenerateTile muted={failed} />
      <p className={cn(SHEET_TITLE_CLASS, "mt-4")}>
        {failed ? "Couldn't generate this profile" : "Generating profile…"}
      </p>
      {name ? (
        <p className="text-foreground mt-1 text-sm font-semibold">{name}</p>
      ) : null}
      {address ? (
        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
          {address}
        </p>
      ) : null}
      {failed ? (
        <>
          <p className="text-muted-foreground mt-4 max-w-xs text-sm">{error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className={cn(PRIMARY_BUTTON_CLASS, "mt-5 max-w-xs")}
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Try again
            </button>
          ) : null}
        </>
      ) : (
        <GenerateSteps key={attempt} className="mt-5" />
      )}
    </div>
  );
}

/** The opening route's screen: a back-only top bar over the view, in the
 *  slide-over or as a page. There is no place yet to name or act on, so
 *  the bar draws no name and no ⋯ (design review D5). */
export function GeneratingPlaceScreen({
  variant,
  ...view
}: {
  variant: "modal" | "page";
  name?: string | null;
  address?: string | null;
  error?: string | null;
  onRetry?: () => void;
  attempt?: number;
}) {
  return variant === "modal" ? (
    <GeneratingSlideOver {...view} />
  ) : (
    <GeneratingPage {...view} />
  );
}

type ViewProps = Parameters<typeof GeneratingPlace>[0];

function GeneratingSlideOver(view: ViewProps) {
  const close = useSlideOverClose();
  return (
    <>
      <PlaceTopBar name={null} onBack={close} backOnly />
      <div className="flex min-h-0 flex-1 items-center justify-center pb-20">
        <GeneratingPlace {...view} />
      </div>
    </>
  );
}

function GeneratingPage(view: ViewProps) {
  // The page hides the bottom bar, so Back must always lead somewhere.
  const router = useRouter();
  const onBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(CONSUMER_ROUTES.home);
  }, [router]);
  return (
    <div className="bg-card relative flex flex-1 flex-col overflow-hidden">
      <style>{`nav[data-shell-nav]{display:none}`}</style>
      <PlaceTopBar name={null} onBack={onBack} backOnly />
      <div className="flex min-h-0 flex-1 items-center justify-center pb-20">
        <GeneratingPlace {...view} />
      </div>
    </div>
  );
}
