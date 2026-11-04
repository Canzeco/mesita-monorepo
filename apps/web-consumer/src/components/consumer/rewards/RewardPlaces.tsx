"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinOff, QrCode, Ticket, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PremierBadge, SizedImg } from "@mesita/place-profile";
import { PLACE_REWARD_COUPON_CLASS } from "@mesita/place-profile/lib/ui";
import { cn } from "@/lib/utils";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared";
import { useActiveLocation } from "@/lib/active-location";
import { isMesitaPlaceId } from "@/lib/api/activity";
import {
  apiFillAreaPool,
  apiListAreaPool,
  mergeFilledPlaces,
  type AreaPool,
  type Place,
} from "@/lib/api/places";
import { apiCreateVisitCode, apiListRewardPercents, visitLink, type VisitCode } from "@/lib/api/rewards";
import { areaPoolKey, readAreaPool, writeAreaPool } from "@/lib/area-pool-cache";
import { mockRewardPercent } from "@/lib/mock-rewards";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  LOCATION_HELP,
  useLocateUser,
  useUserLocation,
  useUserLocationError,
  useUserLocationSettled,
} from "@/lib/use-user-location";
import { errMsg } from "@/lib/utils";

// THE REWARD TAB (Pato, MESITA-3214: "a list of all the places … sorted by
// location. no searchbar … when you click the shit, the QR its actually open").
// Rows under Home's header: every Mesita place, nearest first from the header's
// location. For the moment every place counts as offering rewards.
// What a guest actually gets off the bill is what that place has switched on.
//
// SOCIAL'S ROWS (Pato, MESITA-3223: "why some has borders and the others don't.
// pick one and use same for both"): an endless list, so one white band edge to
// edge, hairlines top and bottom and between rows, never side borders or a
// rounded card (MESITA-2542). It was one rounded card on grey.
//
// LOCATION MUST BE ON: with no fix and no saved pin there is nothing to sort
// from, so this tab asks for it. Home's Monterrey fallback does not apply here.

const PAGE = 20;
/** h-56 and w-56, the QR's bone and its slot. */
const QR_SIZE = 224;
/** Social's band (SocialFeed.tsx). divide-y draws only between direct children. */
const ROWS_BAND = "divide-border border-border bg-card divide-y border-y";

export function RewardPlaces() {
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const origin = useActiveLocation();
  const settled = useUserLocationSettled();
  const locationError = useUserLocationError();
  const locate = useLocateUser();
  const from = origin ?? coords;
  const key = `reward|${areaPoolKey(from)}`;

  const [pool, setPool] = useState<AreaPool | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [fillFailed, setFillFailed] = useState(false);
  // A new `opened` remounts the QR, so every tap asks for a fresh code; `place`
  // stays set while the dialog fades out.
  const [qr, setQr] = useState<{ place: Place; opened: number; open: boolean } | null>(null);

  useEffect(() => {
    if (!from) return;
    let cancelled = false;
    const kept = readAreaPool(key);
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      setPool(kept);
      setFailed(false);
      setFillFailed(false);
    });
    if (!kept) {
      apiListAreaPool(supabase, from, [], { nearest: true }).then(
        (next) => {
          if (cancelled) return;
          writeAreaPool(key, next);
          setPool(next);
        },
        () => {
          if (!cancelled) setFailed(true);
        },
      );
    }
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // `key` names `from`; a new object for the same point is not a new question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, key, attempt]);

  // The server sorts every id once; the rest of the rows load as the guest
  // scrolls, as on Home (MESITA-3057).
  const sentinel = useRef<HTMLLIElement | null>(null);

  // What each row can say (MESITA-3217): asked for places as they load, once
  // each. A failed read only leaves the amounts off; the list still works.
  const [percents, setPercents] = useState<Record<string, number>>({});
  const asked = useRef(new Set<string>());
  const placeIds = (pool?.places ?? []).map((p) => p.id).join(",");
  useEffect(() => {
    if (!placeIds) return;
    const fresh = placeIds.split(",").filter((id) => isMesitaPlaceId(id) && !asked.current.has(id)).slice(0, 100);
    if (fresh.length === 0) return;
    for (const id of fresh) asked.current.add(id);
    apiListRewardPercents(supabase, fresh).then(
      (next) => setPercents((now) => ({ ...now, ...next })),
      () => undefined,
    );
  }, [supabase, placeIds]);

  const hasMore = pool !== null && pool.asked < pool.order.length;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !pool || !hasMore || fillFailed || typeof IntersectionObserver === "undefined") return;
    const start = pool.asked;
    const ids = pool.order.slice(start, start + (pool.pageSize ?? PAGE));
    let busy = false;
    let disposed = false;
    const io = new IntersectionObserver((entries) => {
      if (busy || !entries.some((e) => e.isIntersecting)) return;
      busy = true;
      apiFillAreaPool(supabase, pool.rankedFrom, [], ids).then(
        (filled) => {
          if (disposed) return;
          const merged = mergeFilledPlaces(pool, filled, start + ids.length);
          writeAreaPool(key, merged);
          setPool(merged);
        },
        () => {
          if (!disposed) setFillFailed(true);
        },
      );
    });
    io.observe(el);
    return () => {
      disposed = true;
      io.disconnect();
    };
  }, [supabase, key, pool, hasMore, fillFailed]);

  if (!from) {
    if (!settled) return <RewardRowsSkeleton />;
    return (
      <EmptyState
        icon={MapPinOff}
        title="Turn on your location"
        description={
          locationError
            ? LOCATION_HELP[locationError]
            : "Rewards are listed by what's closest to you."
        }
        action={{ label: "Use my location", onClick: locate }}
      />
    );
  }
  if (failed) {
    return (
      <EmptyState
        icon={QrCode}
        title="Couldn't load the places"
        description="Check your connection and try again."
        action={{
          label: "Try again",
          onClick: () => {
            setFailed(false);
            setAttempt((n) => n + 1);
          },
        }}
      />
    );
  }
  if (!pool) return <RewardRowsSkeleton />;
  if (pool.places.length === 0 && !hasMore) {
    return <EmptyState icon={QrCode} title="No places yet" description="Check back soon." />;
  }

  return (
    <div className="scrollbar-thin-dark min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-6" data-reward-scroller>
      <ul role="list" aria-label="Places" className={ROWS_BAND}>
        {pool.places.map((place) => (
          <li key={place.id}>
            <RewardRow
              place={place}
              percent={percents[place.id] ?? mockRewardPercent(place.id)}
              onOpen={() => setQr((cur) => ({ place, opened: (cur?.opened ?? 0) + 1, open: true }))}
            />
          </li>
        ))}
        {/* The next page, waiting: one grey row, as on Social. */}
        {hasMore && !fillFailed ? (
          <li ref={sentinel} aria-hidden>
            <RewardSkeletonRow />
          </li>
        ) : null}
      </ul>
      {hasMore && fillFailed ? (
        <button
          type="button"
          onClick={() => setFillFailed(false)}
          className="text-muted-foreground mt-3 min-h-11 w-full text-sm underline"
        >
          Try again
        </button>
      ) : null}
      <LocalDialog
        open={qr?.open === true}
        onClose={() => setQr((cur) => (cur ? { ...cur, open: false } : cur))}
        ariaLabel={qr ? `Your code for ${qr.place.name}` : "Your code"}
      >
        {qr ? (
          <RewardQr
            key={qr.opened}
            place={qr.place}
            onClose={() => setQr((cur) => (cur ? { ...cur, open: false } : cur))}
          />
        ) : null}
      </LocalDialog>
    </div>
  );
}

function RewardRow({ place, percent, onOpen }: { place: Place; percent?: number; onOpen: () => void }) {
  const photo = place.photos?.[0];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hover:bg-muted/40 flex min-h-16 w-full items-center gap-3 px-4 py-3.5 text-left transition"
    >
      {photo ? (
        <span className="bg-muted ring-border block h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1">
          <SizedImg src={photo} size="thumb" alt="" className="h-full w-full object-cover" />
        </span>
      ) : (
        <span className="bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
          <QrCode className="h-5 w-5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        {/* The name, its Premier mark, the reward: nothing else (Pato, MESITA-3246). */}
        <span className="flex min-w-0 items-center gap-1 text-sm font-semibold">
          <span className="truncate">{place.name}</span>
          <PremierBadge tier={place.boost_tier} compact ad />
        </span>
        {/* "Up to": Story counts, and staff check it at the till (MESITA-3217). */}
        {percent ? (
          <span className={cn(PLACE_REWARD_COUPON_CLASS, "mt-1 font-semibold")}>
            <Ticket className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            Up to {percent}% OFF for you
          </span>
        ) : null}
      </span>
      <QrCode className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
    </button>
  );
}

function endsAt(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** The guest's code for this place: ten minutes, one use (MESITA-3202). The QR
 *  links to visit.mesita.ai (MESITA-3240), and nobody types the code. A new code
 *  replaces the old one when it ends, so what's on screen always works. */
function RewardQr({ place, onClose }: { place: Place; onClose: () => void }) {
  const supabase = useBrowserSupabase();
  const [code, setCode] = useState<VisitCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    apiCreateVisitCode(supabase, place.id).then(
      (next) => {
        if (!live) return;
        setCode(next);
        setError(null);
      },
      (err) => {
        if (!live) return;
        setCode(null);
        setError(errMsg(err, "Couldn't make a code. Try again."));
      },
    );
    return () => {
      live = false;
    };
  }, [supabase, place.id, attempt]);

  useEffect(() => {
    if (!code) return;
    const timer = setTimeout(
      () => setAttempt((n) => n + 1),
      Math.max(0, new Date(code.expires_at).getTime() - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [code]);

  return (
    <div className="relative flex flex-col items-center p-6 text-center">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="text-muted-foreground absolute top-2 right-2 flex h-11 w-11 items-center justify-center"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
      <p className="w-full truncate px-8 font-semibold">{place.name}</p>
      <div className="mt-4 flex min-h-56 items-center justify-center">
        {code ? (
          <QRCodeSVG value={visitLink(place.id, code.code)} size={QR_SIZE} level="M" marginSize={2} bgColor="#ffffff" fgColor="#000000" />
        ) : error ? (
          <div>
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setAttempt((n) => n + 1);
              }}
              className="text-muted-foreground mt-1 min-h-11 text-sm underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <Skeleton className="h-56 w-56 rounded-xl" />
        )}
      </div>
      {code ? (
        <p aria-live="polite" className="text-muted-foreground mt-4 text-sm">
          Show this to staff. It works until {endsAt(code.expires_at)}.
        </p>
      ) : null}
    </div>
  );
}

/** The card of rows as it will land, in the same margins. */
/** One row, empty: the three lines of a row with its percent. */
function RewardSkeletonRow() {
  return (
    <div className="flex min-h-16 items-center gap-3 px-4 py-3.5">
      <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-3/5" />
        </span>
        <span className="flex h-4 items-center">
          <Skeleton className="h-3 w-2/5" />
        </span>
        <span className="mt-0.5 flex h-4 items-center">
          <Skeleton className="h-3 w-1/2" />
        </span>
      </span>
      <Skeleton className="h-5 w-5 shrink-0" />
    </div>
  );
}

export function RewardRowsSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-hidden pb-6" aria-busy>
      <div className={ROWS_BAND} aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <RewardSkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}
