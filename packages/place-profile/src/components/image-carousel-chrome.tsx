import { cn } from "../lib/format";

export function CarouselPillDots({
  count,
  activeIdx,
  onSelect,
  label = "Photo",
}: {
  count: number;
  activeIdx: number;
  /** When set, each dot is a button that pages to its photo — the only way a
   *  mouse can page a carousel whose tap zones are off (Scroll, MESITA-2105).
   *  Absent, the dots stay a passive indicator, as everywhere else. */
  onSelect?: (i: number) => void;
  label?: string;
}) {
  if (onSelect) {
    // A 44px row of 24px hit areas, each drawing the same pill as below.
    return (
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-11 items-center justify-center">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${label}, photo ${i + 1} of ${count}`}
            aria-current={i === activeIdx ? "true" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(i);
            }}
            className="pointer-events-auto flex h-6 min-w-6 items-center justify-center"
          >
            <span
              className={cn(
                "drop-shadow-media bg-on-media h-1.5 rounded-full transition-all duration-200",
                i === activeIdx ? "w-5 opacity-100" : "w-1.5 opacity-60",
              )}
            />
          </button>
        ))}
      </div>
    );
  }
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
  onKeyLeft,
  onKeyRight,
}: {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUpLeft: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUpRight: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onKeyLeft: () => void;
  onKeyRight: () => void;
}) {
  const onKey =
    (activate: () => void) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
      activate();
    };
  return (
    <>
      <button
        type="button"
        aria-label="Previous photo"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUpLeft}
        onKeyDown={onKey(onKeyLeft)}
        className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-default bg-transparent"
      />
      <button
        type="button"
        aria-label="Next photo"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUpRight}
        onKeyDown={onKey(onKeyRight)}
        className="absolute inset-y-0 right-0 z-10 w-1/3 cursor-default bg-transparent"
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
