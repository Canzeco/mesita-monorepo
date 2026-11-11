"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  apiListAreaPool,
  type AreaOrigin,
  type AreaPool,
  type Place,
} from "@/lib/api/places";
import {
  areaPoolKey,
  readAreaPool,
  writeAreaPool,
} from "@/lib/area-pool-cache";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { withUserDistance } from "@/lib/place-distance";
import type { Coords } from "@/lib/use-user-location";
import { useCreatedPlaces, withCreatedPlaces } from "@/lib/created-places";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import type { CardSaveShare } from "@/lib/use-card-save-share";
import { EmptyState } from "@/components/shared";
import { Compass } from "lucide-react";
import { RailSkeleton } from "./DiscoverFallback";
import { PlaceRailCard } from "./PlaceRailCard";
import { GRID_CHIPS, RAIL_TITLE, RAIL_TRACK } from "./place-grid-classes";
import { cn } from "@/lib/utils";

/** A carousel's anchor on the page, for the family bar's jumps. */
const railId = (key: string) => `rail-${key}`;

/** One carousel's family: Top (`all`, no family) or one family key. */
export type RailSpec = { key: string; label: string; emoji: string };

/** What a carousel asks the pool for: no family for Top, else its own. */
function railFamilies(key: string, allKey: string): string[] {
  return key === allKey ? [] : [key];
}

/**
 * PLACES 4.0 (Pato, MESITA-3670: "an horizontal catalog. more like open
 * table. one horizontal carousel for category … Top carousel on top,
 * breakfast carousel then and so on. 1.5 items per wide screen").
 *
 * One carousel per family, Top first, in the chip order. Each asks the
 * server for its own family's ranked pool, through the same ten-minute
 * cache as Places 1.0–3.0, and only when it scrolls within 400px of the
 * screen, so a visit never fires every family at once. A carousel shows
 * the first page the pool fills, no sideways paging. A family with nothing
 * near hides; an empty or failed Top says so.
 */
export function PlaceRails({
  rails,
  allKey,
  from,
  coords,
  cards,
  onOpenCard,
  onOpenGoogle,
  onSeeAll,
}: {
  rails: RailSpec[];
  allKey: string;
  from: AreaOrigin;
  coords: Coords | null;
  cards: CardSaveShare;
  onOpenCard: (place: Place, rank: number, rail: string) => void;
  onOpenGoogle: (place: Place) => void;
  /** "See all": open Places 3.0 on that family. */
  onSeeAll: (key: string) => void;
}) {
  // THE FAMILY BAR (Pato, MESITA-3673: "show the family horizontal
  // carousel, and as i vertically scroll to the bottom, you need to
  // horizontally scroll the family and change the selected family, like
  // those cool section horizontal header menus … in the landing pages"):
  // the pills pinned at the top of the pane; the carousel under the bar
  // lights its pill and the row slides to keep it centred; a tap scrolls
  // to that carousel. A hidden carousel drops its pill.
  const root = useRef<HTMLDivElement | null>(null);
  const bar = useRef<HTMLElement | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [active, setActive] = useState(rails[0]?.key ?? allKey);
  const shown = rails.filter((r) => !hidden.has(r.key));
  const hide = useCallback(
    (key: string) => setHidden((h) => (h.has(key) ? h : new Set(h).add(key))),
    [],
  );
  const scroller = () =>
    root.current?.closest<HTMLElement>("[data-home-scroller]") ?? null;

  // Scroll-spy: the last carousel whose top has crossed the MIDDLE of the
  // visible pane under the bar (Pato, MESITA-3674: "it really waits until
  // the family is at the top … switch before"); it was the bar's own edge.
  // At the bottom of the pane the last family lights, though its top may
  // never reach the middle.
  useEffect(() => {
    const pane = scroller();
    if (!pane) return;
    let frame = 0;
    const spy = () => {
      frame = 0;
      const box = pane.getBoundingClientRect();
      const barH = bar.current?.offsetHeight ?? 0;
      const line = box.top + barH + (box.height - barH) / 2;
      let current = shown[0]?.key;
      for (const r of shown) {
        const el = document.getElementById(railId(r.key));
        if (el && el.getBoundingClientRect().top <= line) current = r.key;
      }
      const atBottom =
        pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 4;
      if (atBottom && shown.length > 0) current = shown[shown.length - 1].key;
      if (current) setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(spy);
    };
    pane.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      pane.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.map((r) => r.key).join(",")]);

  // Keep the lit pill centred in the bar.
  useEffect(() => {
    const row = bar.current;
    const pill = row?.querySelector<HTMLElement>(
      `[data-rail-pill="${active}"]`,
    );
    if (!row || !pill) return;
    row.scrollTo({
      left: pill.offsetLeft - (row.clientWidth - pill.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [active]);

  const jump = (key: string) => {
    const pane = scroller();
    const el = document.getElementById(railId(key));
    if (!pane || !el) return;
    const top =
      el.getBoundingClientRect().top -
      pane.getBoundingClientRect().top +
      pane.scrollTop -
      (bar.current?.offsetHeight ?? 0);
    pane.scrollTo({ top, behavior: "smooth" });
    setActive(key);
  };

  return (
    <div ref={root} className="pb-6" data-places-rails>
      <nav
        ref={bar}
        aria-label="Families"
        className={cn("bg-card sticky top-0 z-10", GRID_CHIPS)}
        data-rails-bar
      >
        {shown.map((r) => {
          const on = r.key === active;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => jump(r.key)}
              aria-current={on ? "true" : undefined}
              className={cn(
                "relative h-8 shrink-0 rounded-full px-3 text-xs transition after:absolute after:inset-x-0 after:-inset-y-1.5",
                on
                  ? "bg-foreground text-card font-semibold"
                  : "bg-border/60 text-foreground hover:bg-border",
              )}
              data-rail-pill={r.key}
            >
              <span aria-hidden className="mr-1">
                {r.emoji}
              </span>
              {r.label}
            </button>
          );
        })}
      </nav>
      {rails.map((rail, i) => (
        <Rail
          onHidden={hide}
          key={rail.key}
          rail={rail}
          top={rail.key === allKey}
          families={railFamilies(rail.key, allKey)}
          eager={i === 0}
          from={from}
          coords={coords}
          cards={cards}
          onOpenCard={onOpenCard}
          onOpenGoogle={onOpenGoogle}
          onSeeAll={onSeeAll}
        />
      ))}
    </div>
  );
}

function Rail({
  rail,
  top,
  families,
  eager,
  from,
  coords,
  cards,
  onOpenCard,
  onOpenGoogle,
  onSeeAll,
  onHidden,
}: {
  onHidden: (key: string) => void;
  rail: RailSpec;
  top: boolean;
  families: string[];
  eager: boolean;
  from: AreaOrigin;
  coords: Coords | null;
  cards: CardSaveShare;
  onOpenCard: (place: Place, rank: number, rail: string) => void;
  onOpenGoogle: (place: Place) => void;
  onSeeAll: (key: string) => void;
}) {
  const supabase = useBrowserSupabase();
  const createdPlaces = useCreatedPlaces();
  const box = useRef<HTMLElement | null>(null);
  const [near, setNear] = useState(eager);
  const requestKey = `${areaPoolKey(from)}|${
    families.length > 0 ? families.join(",") : "all"
  }`;
  const [pool, setPool] = useState<AreaPool | null>(() =>
    readAreaPool(requestKey),
  );
  const [failed, setFailed] = useState(false);

  // Wake when the carousel comes within 400px of the screen.
  useEffect(() => {
    if (near) return;
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    const kept = readAreaPool(requestKey);
    if (kept) {
      const raf = requestAnimationFrame(() => {
        if (!cancelled) setPool(kept);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }
    apiListAreaPool(supabase, from, families)
      .then((next) => {
        if (cancelled) return;
        writeAreaPool(requestKey, next);
        setPool(next);
        setFailed(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[rails] load failed", { rail: rail.key, err });
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, requestKey, supabase]);

  const title = `${rail.emoji} ${rail.label}`;
  const places = pool
    ? withCreatedPlaces(
        top
          ? pool.places
          : pool.places.filter((p) =>
              (p.area?.familyKeys ?? []).includes(rail.key),
            ),
        createdPlaces,
      )
    : [];

  // A family with nothing near, or one that failed, hides (and its pill
  // with it); Top says so.
  const gone = !top && ((pool !== null && places.length === 0) || failed);
  useEffect(() => {
    if (gone) onHidden(rail.key);
  }, [gone, onHidden, rail.key]);
  if ((pool && places.length === 0) || failed) {
    if (!top) return null;
    return (
      <EmptyState
        icon={Compass}
        title={failed ? "Couldn't load the catalog" : "No places yet"}
        description={
          failed
            ? "Tonight's places didn't come back. Try again in a moment."
            : "Check back soon."
        }
      />
    );
  }

  return (
    <section
      ref={box}
      id={railId(rail.key)}
      aria-label={rail.label}
      data-rail={rail.key}
    >
      {pool === null ? (
        <RailSkeleton title={title} />
      ) : (
        <>
          <div className={RAIL_TITLE}>
            <h2 className="text-base font-semibold">{title}</h2>
            <Link
              href={CONSUMER_ROUTES.home}
              replace
              scroll={false}
              onClick={() => onSeeAll(rail.key)}
              className="text-muted-foreground hover:text-foreground -my-2 flex items-center gap-0.5 py-2 text-sm font-semibold"
              data-rail-see-all
            >
              See all
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <ul role="list" aria-label={rail.label} className={RAIL_TRACK}>
            {places.map((place, i) => (
              <PlaceRailCard
                key={place.id}
                place={withUserDistance(place, coords)}
                family={top ? null : rail.label}
                saved={cards.isSaved(place)}
                onToggle={() => cards.toggle(place, i + 1)}
                onShare={() => cards.share(place)}
                onOpen={() => onOpenCard(place, i + 1, rail.key)}
                onOpenGoogle={() => onOpenGoogle(place)}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
