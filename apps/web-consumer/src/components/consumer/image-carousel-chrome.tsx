import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

export function CarouselMuteButton({
  muted,
  mutePosition,
  multiSlide,
  onToggle,
}: {
  muted: boolean;
  mutePosition: "bottom-right" | "top-right";
  multiSlide: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-label={muted ? "Unmute video" : "Mute video"}
      data-no-swipe
      className={cn(
        "absolute z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80",
        mutePosition === "top-right"
          ? multiSlide
            ? "top-12 right-3"
            : "top-3 right-3"
          : "right-3 bottom-3",
      )}
    >
      {muted ? (
        <VolumeX className="h-4 w-4" />
      ) : (
        <Volume2 className="h-4 w-4" />
      )}
    </button>
  );
}

export function CarouselPillDots({
  count,
  activeIdx,
}: {
  count: number;
  activeIdx: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            "drop-shadow-media h-1.5 rounded-full bg-white transition-all duration-200",
            i === activeIdx ? "w-5 opacity-100" : "w-1.5 opacity-60",
          )}
        />
      ))}
    </div>
  );
}

export function CarouselTapZones({
  onPointerDown,
  onPointerUpLeft,
  onPointerUpRight,
}: {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUpLeft: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUpRight: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <>
      <div
        role="button"
        aria-label="Previous photo"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUpLeft}
        className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-default"
      />
      <div
        role="button"
        aria-label="Next photo"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUpRight}
        className="absolute inset-y-0 right-0 z-10 w-1/3 cursor-default"
      />
    </>
  );
}

export function CarouselSlideCounter({
  idx,
  count,
}: {
  idx: number;
  count: number;
}) {
  return (
    <div className="shadow-media type-meta pointer-events-none absolute top-3 right-3 z-10 rounded-full bg-black/60 px-2 py-0.5 font-semibold text-white backdrop-blur">
      {idx + 1} / {count}
    </div>
  );
}
