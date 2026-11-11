"use client";

import { useEffect, useRef, useState } from "react";
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
import { RAIL_TITLE, RAIL_TRACK } from "./place-grid-classes";

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
  return (
    <div className="pb-6" data-places-rails>
      {rails.map((rail, i) => (
        <Rail
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
}: {
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

  // A family with nothing near, or one that failed, hides; Top says so.
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
    <section ref={box} aria-label={rail.label} data-rail={rail.key}>
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
