import { Hand, Heart, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Z_IN_FRAME_OVERLAY } from "@/lib/z-index";

export function SwipeExitStamp({
  direction,
}: {
  direction: "left" | "right" | null;
}) {
  if (!direction) return null;

  const isSavedStamp = direction === "right";

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        Z_IN_FRAME_OVERLAY,
      )}
    >
      <span
        className={cn(
          "animate-in fade-in zoom-in-50 inline-flex items-center gap-2 rounded-2xl border-[3px] px-5 py-2.5 text-2xl font-black tracking-[0.14em] uppercase duration-200 ease-out",
          isSavedStamp
            ? "bg-pink-gradient shadow-glow -rotate-[8deg] border-white text-white"
            : "border-foreground/70 bg-foreground/85 text-background rotate-[8deg]",
        )}
      >
        {isSavedStamp ? (
          <>
            <Heart className="h-6 w-6 fill-white" />
            Saved
          </>
        ) : (
          <>
            <X className="h-6 w-6 stroke-[3]" />
            Skip
          </>
        )}
      </span>
    </div>
  );
}

export function SwipeTutorialOverlay() {
  return (
    <div className="animate-in fade-in pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px] duration-500">
      <div className="flex flex-col items-center gap-5">
        <div className="animate-swipe-hint">
          <Hand
            className="drop-shadow-media-lg h-20 w-20 text-white"
            strokeWidth={1.4}
          />
        </div>
        <p className="type-body text-center font-medium tracking-wide text-white/95">
          Swipe left to skip
          <span className="mx-1.5 opacity-50">·</span>
          right to save
        </p>
      </div>
    </div>
  );
}
