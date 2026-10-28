"use client";

// GENERATING A PROFILE (Pato, MESITA-2935: "don't show this ugly ass ui …
// show something simpler indicating that the place is being created"; "use
// word generate, it feels more AI, and use AI icon"). One calm view while
// get-or-create runs: the sparkles tile, "Generating profile", the place's
// name and address. It replaced the draft profile (a blue Creating fact,
// "-" stats, Reserve and an empty Overview) that told a guest a place was
// new only after they opened it — nearby search is gone, and the row they
// tapped already said Generate. Drawn by the Search confirm sheet
// (GeneratePlaceSheet) and by the opening route (OpeningGooglePlace, its
// loading files) for Home, Favorites and deep links.

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { PlaceTopBar } from "@mesita/place-profile";
import { useSlideOverClose } from "@/components/consumer/overlay/SlideOverShell";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { PRIMARY_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export function GeneratingPlace({
  name,
  address,
  error,
  onRetry,
  className,
}: {
  name?: string | null;
  address?: string | null;
  /** A refusal: the message replaces the wait, with Try again. */
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  const failed = Boolean(error);
  return (
    <div
      className={cn("flex flex-col items-center px-6 text-center", className)}
      role="status"
      aria-live="polite"
      aria-busy={!failed}
      data-generating-place={failed ? "failed" : "running"}
    >
      <span
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-2xl",
          failed ? "bg-muted text-muted-foreground" : "bg-foreground text-paper",
        )}
      >
        <Sparkles
          className={cn("h-7 w-7", !failed && "animate-pulse")}
          strokeWidth={2}
          aria-hidden
        />
      </span>
      <p className="mt-5 text-lg font-semibold tracking-tight">
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
      <p className="text-muted-foreground mt-4 max-w-xs text-sm">
        {failed
          ? error
          : "Mesita is building it from Google. This takes a few seconds."}
      </p>
      {failed && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={cn(PRIMARY_BUTTON_CLASS, "mt-5 max-w-xs")}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Try again
        </button>
      ) : null}
    </div>
  );
}

/** The opening route's screen: a bare top bar (Back only) over the view,
 *  in the slide-over or as a page. The name lives in the view, once. */
export function GeneratingPlaceScreen({
  variant,
  ...view
}: {
  variant: "modal" | "page";
  name?: string | null;
  address?: string | null;
  error?: string | null;
  onRetry?: () => void;
}) {
  return variant === "modal" ? (
    <GeneratingSlideOver {...view} />
  ) : (
    <GeneratingPage {...view} />
  );
}

type ViewProps = Omit<Parameters<typeof GeneratingPlace>[0], "className">;

function GeneratingSlideOver(view: ViewProps) {
  const close = useSlideOverClose();
  return (
    <>
      <PlaceTopBar name={null} onBack={close} />
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
      <PlaceTopBar name={null} onBack={onBack} />
      <div className="flex min-h-0 flex-1 items-center justify-center pb-20">
        <GeneratingPlace {...view} />
      </div>
    </div>
  );
}
