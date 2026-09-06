"use client";

// Photos — the console's first image, and the masthead of the Place screen.
//
// It is called Photos, never "preview" and never "what guests see". The real
// guest card (web-consumer SwipeCardInfo) carries price level, distance,
// zone, follower counts, open-now and a promo chip; this shows photographs.
// Calling it a preview would be a claim the component cannot keep.
//
// LAYOUT. Fixed heights, never an aspect ratio: these `<img>` elements have
// no intrinsic width/height, so an aspect-driven band resizes on every load
// and shifts the page under the reader. The shell column is 864px, so at
// `md` the band is a 3x2 grid with the cover taking four cells; below `md`
// it is a 4:3 cover plus a snapping thumbnail rail.
//
// The band carries NO text and NO chips. The page header above it already
// renders the name, the category and the Listed/Verified badge — repeating
// them over a dark scrim would state the same fact three times in 500px, in
// consumer-app clothing, on a console whose rule is "calm and high-density".
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/** Tiles beside the cover at `md`. The cover spans 2x2 of a 3x2 grid, so two
 *  cells remain; the second carries the +N affordance when there are more. */
const SIDE_TILES = 2;

export function PlaceGallery({
  photos,
  totalPhotos,
  name,
}: {
  /** Already capped by the EF. Empty is the common case, not an error: 1 of
   *  23 live places has no photo and 7 are not enriched yet. */
  photos: string[];
  /** The true count before the cap, for the caption. */
  totalPhotos: number;
  name: string;
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <section aria-labelledby="place-photos">
        <h2 id="place-photos" className={cn(TINY_LABEL_CLASS, "mb-2 block")}>
          Photos
        </h2>
        <EmptyState
          icon={<ImageOff className="text-muted-foreground h-5 w-5" />}
          title="No photos yet"
          description="Your listing shows a placeholder card to guests until this place has a cover photo."
        />
      </section>
    );
  }

  const [cover, ...rest] = photos;
  const side = rest.slice(0, SIDE_TILES);
  const hidden = totalPhotos - 1 - side.length;

  return (
    <section aria-labelledby="place-photos">
      <h2 id="place-photos" className={cn(TINY_LABEL_CLASS, "mb-2 block")}>
        Photos
      </h2>

      <div className="border-border overflow-hidden rounded-2xl border">
        {/* md and up: the mosaic. */}
        <div className="hidden h-[300px] grid-cols-3 grid-rows-2 gap-2 md:grid">
          <Tile
            src={cover}
            alt={name}
            priority
            onOpen={() => setOpenAt(0)}
            label="Photo 1"
            className="col-span-2 row-span-2"
          />
          {side.map((src, i) => (
            <Tile
              key={src}
              src={src}
              onOpen={() => setOpenAt(i + 1)}
              label={`Photo ${i + 2}`}
              // The last visible tile carries the overflow count when the
              // set is bigger than the mosaic.
              overflow={i === side.length - 1 && hidden > 0 ? hidden : 0}
            />
          ))}
        </div>

        {/* Below md: a 4:3 cover and a rail that snaps. */}
        <div className="md:hidden">
          <Tile
            src={cover}
            alt={name}
            priority
            onOpen={() => setOpenAt(0)}
            label="Photo 1"
            className="h-[260px] w-full"
          />
          {rest.length > 0 && (
            <div className="flex snap-x gap-2 overflow-x-auto p-2">
              {rest.map((src, i) => (
                <Tile
                  key={src}
                  src={src}
                  onOpen={() => setOpenAt(i + 1)}
                  label={`Photo ${i + 2}`}
                  className="h-16 w-16 shrink-0 snap-start rounded-lg"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* The one line on this screen no other console shows, and it is true:
          `photos[0]` is the cover everywhere a guest meets this place. */}
      <p className="text-muted-foreground mt-2 text-[12px]">
        {photos.length === totalPhotos
          ? `${totalPhotos} ${totalPhotos === 1 ? "photo" : "photos"}`
          : `${photos.length} of ${totalPhotos} photos`}
        {" · guests see them in this order"}
      </p>

      {openAt !== null && (
        <Lightbox
          photos={photos}
          index={openAt}
          name={name}
          onClose={() => setOpenAt(null)}
        />
      )}
    </section>
  );
}

/** One clickable photo. A `<button>` rather than a div so the keyboard and
 *  the screen reader both get it for free, with a visible focus ring — the
 *  shell had no ring convention before this, so it is set here. */
function Tile({
  src,
  alt = "",
  label,
  onOpen,
  className,
  overflow = 0,
  priority = false,
}: {
  src: string;
  alt?: string;
  label: string;
  onOpen: () => void;
  className?: string;
  overflow?: number;
  priority?: boolean;
}) {
  // A deleted storage object would otherwise paint the browser's broken-image
  // glyph inside an otherwise finished card.
  const [broken, setBroken] = useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={overflow > 0 ? `${label}, and ${overflow} more` : label}
      className={cn(
        "bg-muted focus-visible:ring-foreground/40 relative block overflow-hidden outline-none focus-visible:ring-2",
        className,
      )}
    >
      {broken ? (
        <span className="text-muted-foreground flex h-full w-full items-center justify-center">
          <ImageOff className="h-5 w-5" />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onError={() => setBroken(true)}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          className="h-full w-full object-cover"
        />
      )}
      {overflow > 0 && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold text-white">
          +{overflow}
        </span>
      )}
    </button>
  );
}

/** Radix Dialog, not a hand-rolled overlay: focus trap, focus restore,
 *  Escape and scroll lock are its job, and this package has no DOM test
 *  environment (vitest runs on `node`), so hand-rolling them would ship the
 *  least testable code in the change. Arrow-key paging is the only behavior
 *  Radix does not own, so it is the only one written here. */
function Lightbox({
  photos,
  index,
  name,
  onClose,
}: {
  photos: string[];
  index: number;
  name: string;
  onClose: () => void;
}) {
  const [at, setAt] = useState(index);
  const closeRef = useRef<HTMLButtonElement>(null);

  const step = useCallback(
    (delta: number) =>
      setAt((i) => (i + delta + photos.length) % photos.length),
    [photos.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [step]);

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            closeRef.current?.focus();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 outline-none"
        >
          <Dialog.Title className="sr-only">
            {`${name} — photo ${at + 1} of ${photos.length}`}
          </Dialog.Title>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[at]}
            alt={`${name}, photo ${at + 1} of ${photos.length}`}
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
          />

          <Dialog.Close
            ref={closeRef}
            aria-label="Close photos"
            className="text-foreground absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 transition outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>

          {photos.length > 1 && (
            <>
              <NavButton side="left" onClick={() => step(-1)} />
              <NavButton side="right" onClick={() => step(1)} />
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function NavButton({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={cn(
        // 44px, the touch-target minimum. The source this replaced used 4x12px
        // dots, which is why they are gone rather than shrunk.
        "text-foreground absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 transition outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-white",
        side === "left" ? "left-4" : "right-4",
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
